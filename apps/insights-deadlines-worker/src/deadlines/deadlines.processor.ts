import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import Redis from 'ioredis';
import {
  QUEUE_NAMES,
  type JobPayload,
  type DeadlinesResult,
  withRetry,
  withTimeout,
  CircuitBreakerService,
  type CircuitBreakerConfig,
  CircuitOpenError,
  IdempotencyService,
  MeetingStateService,
  MaxRetriesExceededError,
  FAN_IN_KEYS,
  FAN_IN_TTL_SECONDS,
  REDIS_CLIENT,
} from '@pipeline/shared';
import { DeadlinesMockService } from './mock/deadlines.mock';

const CB_CONFIG: CircuitBreakerConfig = {
  failureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD ?? '3', 10),
  cooldownMs: parseInt(process.env.CB_COOLDOWN_MS ?? '30000', 10),
};
const RETRY_OPTS = {
  attempts: parseInt(process.env.RETRY_ATTEMPTS ?? '3', 10),
  baseDelayMs: parseInt(process.env.RETRY_BASE_DELAY_MS ?? '1000', 10),
};
const TIMEOUT_MS = parseInt(
  process.env.INSIGHTS_DEADLINES_TIMEOUT_MS ?? '6000',
  10,
);
const SERVICE = 'mock-deadlines-api';
const STAGE = 'deadlines';

@Processor(QUEUE_NAMES.INSIGHTS_DEADLINES, { concurrency: 2 })
export class DeadlinesProcessor extends WorkerHost {
  private readonly logger = new Logger(DeadlinesProcessor.name);

  constructor(
    private readonly mock: DeadlinesMockService,
    private readonly cb: CircuitBreakerService,
    private readonly idempotency: IdempotencyService,
    private readonly meetingState: MeetingStateService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    super();
  }

  async process(job: Job<JobPayload>): Promise<DeadlinesResult> {
    const { meetingId, idempotencyKey } = job.data;
    this.logger.log(
      `[${meetingId}] Deadlines attempt #${job.attemptsMade + 1}`,
    );

    const cached = await this.idempotency.get<DeadlinesResult>(
      STAGE,
      idempotencyKey,
    );
    if (cached) {
      await this.fanIn(meetingId, cached);
      return cached;
    }

    let result: DeadlinesResult;
    try {
      const transcript = job.data.cleaning!.cleanedTranscript;
      result = await withRetry(async () => {
        await this.cb.isAllowed(SERVICE, CB_CONFIG);
        return withTimeout(
          (signal) => this.mock.extract(transcript, signal),
          TIMEOUT_MS,
          'Deadlines',
        );
      }, RETRY_OPTS);
      await this.cb.recordSuccess(SERVICE);
    } catch (err) {
      if (!(err instanceof CircuitOpenError)) {
        await this.cb.recordFailure(SERVICE, CB_CONFIG);
      }
      this.logger.warn(`[${meetingId}] Deadlines failed — using fallback`);
      result = this.mock.degraded(
        err instanceof MaxRetriesExceededError
          ? err.lastError.message
          : (err as Error).message,
      );
    }

    await this.idempotency.set(STAGE, idempotencyKey, result);
    await this.meetingState.addPipelineResult(meetingId, 'deadlines', result);
    await this.fanIn(meetingId, result);

    return result;
  }

  /**
   * Fan-In (mirror of Summary): checks if Summary is already done.
   * Whichever worker finishes second consolidates the meeting state.
   */
  private async fanIn(
    meetingId: string,
    deadlinesResult: DeadlinesResult,
  ): Promise<void> {
    await this.redis.setex(
      FAN_IN_KEYS.deadlinesResult(meetingId),
      FAN_IN_TTL_SECONDS,
      JSON.stringify(deadlinesResult),
    );
    await this.redis.setex(
      FAN_IN_KEYS.deadlinesDone(meetingId),
      FAN_IN_TTL_SECONDS,
      '1',
    );

    const isSummaryDone = await this.redis.exists(
      FAN_IN_KEYS.summaryDone(meetingId),
    );

    if (isSummaryDone) {
      this.logger.log(`[${meetingId}] Both insights done — consolidating`);
      // Check if Summary used fallback too (fetch from Redis)
      const summaryRaw = await this.redis.get(
        FAN_IN_KEYS.summaryResult(meetingId),
      );
      const summaryFallback = summaryRaw
        ? (JSON.parse(summaryRaw) as { fallback: boolean }).fallback
        : false;
      const hasPartial = deadlinesResult.fallback || summaryFallback;
      await this.meetingState.setCompleted(meetingId, hasPartial);
    } else {
      this.logger.log(`[${meetingId}] Deadlines done — waiting for summary`);
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<JobPayload> | undefined, err: Error): Promise<void> {
    if (!job) return;
    this.logger.error(
      `[${job.data.meetingId}] Deadlines infrastructure failure: ${err.message}`,
    );
  }
}
