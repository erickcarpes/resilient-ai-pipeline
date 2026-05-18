import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import {
  QUEUE_NAMES,
  type JobPayload,
  type CleaningResult,
  withRetry,
  withTimeout,
  CircuitBreakerService,
  type CircuitBreakerConfig,
  CircuitOpenError,
  IdempotencyService,
  MeetingStateService,
  MeetingStatus,
  MaxRetriesExceededError,
} from '@pipeline/shared';
import { CleaningMockService } from './mock/cleaning.mock';

const CB_CONFIG: CircuitBreakerConfig = {
  failureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD ?? '3', 10),
  cooldownMs: parseInt(process.env.CB_COOLDOWN_MS ?? '30000', 10),
};
const RETRY_OPTS = {
  attempts: parseInt(process.env.RETRY_ATTEMPTS ?? '3', 10),
  baseDelayMs: parseInt(process.env.RETRY_BASE_DELAY_MS ?? '1000', 10),
};
const TIMEOUT_MS = parseInt(process.env.CLEANING_TIMEOUT_MS ?? '2000', 10);
const SERVICE = 'mock-cleaning-api';
const STAGE = 'cleaning';
const FAN_OUT_JOB_OPTS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { count: 100 },
  removeOnFail: false,
};

@Processor(QUEUE_NAMES.CLEANING, { concurrency: 2 })
export class CleaningProcessor extends WorkerHost {
  private readonly logger = new Logger(CleaningProcessor.name);

  constructor(
    private readonly mock: CleaningMockService,
    private readonly cb: CircuitBreakerService,
    private readonly idempotency: IdempotencyService,
    private readonly meetingState: MeetingStateService,
    // Fan-Out: two queues to publish to simultaneously
    @InjectQueue(QUEUE_NAMES.INSIGHTS_SUMMARY)
    private readonly summaryQueue: Queue,
    @InjectQueue(QUEUE_NAMES.INSIGHTS_DEADLINES)
    private readonly deadlinesQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<JobPayload>): Promise<CleaningResult> {
    const { meetingId, idempotencyKey } = job.data;
    this.logger.log(`[${meetingId}] Cleaning attempt #${job.attemptsMade + 1}`);

    const cached = await this.idempotency.get<CleaningResult>(
      STAGE,
      idempotencyKey,
    );
    if (cached) {
      this.logger.log(`[${meetingId}] Cache HIT — fan-out to insights`);
      await this.fanOut(job.data, cached);
      return cached;
    }

    await this.meetingState.setJobState(meetingId, MeetingStatus.PROCESSING);

    let result: CleaningResult;
    try {
      const transcript = job.data.transcription!.transcript;
      result = await withRetry(async () => {
        await this.cb.isAllowed(SERVICE, CB_CONFIG);
        return withTimeout(
          (signal) => this.mock.clean(transcript, signal),
          TIMEOUT_MS,
          'Cleaning',
        );
      }, RETRY_OPTS);
      await this.cb.recordSuccess(SERVICE);
    } catch (err) {
      if (!(err instanceof CircuitOpenError)) {
        await this.cb.recordFailure(SERVICE, CB_CONFIG);
      }
      throw err;
    }

    await this.idempotency.set(STAGE, idempotencyKey, result);
    await this.meetingState.addPipelineResult(meetingId, 'cleaning', result);

    // ── FAN-OUT ─────────────────────────────────────────────────────────────
    // Both insights workers receive the SAME payload simultaneously.
    // They will race to completion and the second one consolidates.
    await this.fanOut(job.data, result);

    return result;
  }

  private async fanOut(
    payload: JobPayload,
    cleaningResult: CleaningResult,
  ): Promise<void> {
    const enriched = { ...payload, cleaning: cleaningResult };
    const { meetingId } = payload;

    await Promise.all([
      this.summaryQueue.add('process', enriched, {
        jobId: `${meetingId}-summary`,
        ...FAN_OUT_JOB_OPTS,
      }),
      this.deadlinesQueue.add('process', enriched, {
        jobId: `${meetingId}-deadlines`,
        ...FAN_OUT_JOB_OPTS,
      }),
    ]);

    this.logger.log(
      `[${meetingId}] Fan-Out → insights-summary + insights-deadlines`,
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<JobPayload> | undefined, err: Error): Promise<void> {
    if (!job) return;
    const msg =
      err instanceof MaxRetriesExceededError
        ? `Inner retries exhausted: ${err.lastError.message}`
        : err.message;
    await this.meetingState.setFailed(job.data.meetingId, msg);
  }
}
