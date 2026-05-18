import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import Redis from 'ioredis';
import {
  QUEUE_NAMES,
  type JobPayload,
  type SummaryResult,
  type DeadlinesResult,
  withRetry,
  withTimeout,
  CircuitBreakerService,
  type CircuitBreakerConfig,
  CircuitOpenError,
  IdempotencyService,
  MeetingStateService,
  MeetingStatus,
  MaxRetriesExceededError,
  FAN_IN_KEYS,
  FAN_IN_TTL_SECONDS,
  REDIS_CLIENT,
} from '@pipeline/shared';
import { SummaryMockService } from './mock/summary.mock';

const CB_CONFIG: CircuitBreakerConfig = {
  failureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD ?? '3', 10),
  cooldownMs: parseInt(process.env.CB_COOLDOWN_MS ?? '30000', 10),
};
const RETRY_OPTS = {
  attempts: parseInt(process.env.RETRY_ATTEMPTS ?? '3', 10),
  baseDelayMs: parseInt(process.env.RETRY_BASE_DELAY_MS ?? '1000', 10),
};
const TIMEOUT_MS = parseInt(
  process.env.INSIGHTS_SUMMARY_TIMEOUT_MS ?? '8000',
  10,
);
const SERVICE = 'mock-summary-api';
const STAGE = 'summary';

@Processor(QUEUE_NAMES.INSIGHTS_SUMMARY)
export class SummaryProcessor extends WorkerHost {
  private readonly logger = new Logger(SummaryProcessor.name);

  constructor(
    private readonly mock: SummaryMockService,
    private readonly cb: CircuitBreakerService,
    private readonly idempotency: IdempotencyService,
    private readonly meetingState: MeetingStateService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    super();
  }

  async process(job: Job<JobPayload>): Promise<SummaryResult> {
    const { meetingId, idempotencyKey } = job.data;
    this.logger.log(`[${meetingId}] Summary attempt #${job.attemptsMade + 1}`);

    const cached = await this.idempotency.get<SummaryResult>(STAGE, idempotencyKey);
    if (cached) {
      this.logger.log(`[${meetingId}] Summary cache HIT — running Fan-In check`);
      await this.fanIn(meetingId, cached);
      return cached;
    }

    // Try to extract summary — fallback gracefully on exhausted retries
    let result: SummaryResult;
    try {
      const transcript = job.data.cleaning!.cleanedTranscript;
      result = await withRetry(
        async () => {
          await this.cb.isAllowed(SERVICE, CB_CONFIG);
          return withTimeout(
            this.mock.extract(transcript),
            TIMEOUT_MS,
            'Summary',
          );
        },
        RETRY_OPTS,
      );
      await this.cb.recordSuccess(SERVICE);
    } catch (err) {
      if (!(err instanceof CircuitOpenError)) {
        await this.cb.recordFailure(SERVICE, CB_CONFIG);
      }
      // Insights use FALLBACK instead of crashing — pipeline still completes
      this.logger.warn(`[${meetingId}] Summary failed — using fallback`);
      result = this.mock.degraded(
        err instanceof MaxRetriesExceededError
          ? err.lastError.message
          : (err as Error).message,
      );
    }

    await this.idempotency.set(STAGE, idempotencyKey, result);
    await this.meetingState.addPipelineResult(meetingId, 'summary', result);

    // ── FAN-IN ──────────────────────────────────────────────────────────────
    await this.fanIn(meetingId, result);

    return result;
  }

  /**
   * Fan-In coordination — "last-writer-wins" pattern.
   * Mark ourselves as done, then check if the Deadlines worker is also done.
   * If YES: we are second → consolidate and mark Meeting as COMPLETED/PARTIAL.
   * If NO:  we are first → Deadlines worker will consolidate when it finishes.
   */
  private async fanIn(
    meetingId: string,
    summaryResult: SummaryResult,
  ): Promise<void> {
    // 1. Persist our result and mark done
    await this.redis.setex(
      FAN_IN_KEYS.summaryResult(meetingId),
      FAN_IN_TTL_SECONDS,
      JSON.stringify(summaryResult),
    );
    await this.redis.setex(
      FAN_IN_KEYS.summaryDone(meetingId),
      FAN_IN_TTL_SECONDS,
      '1',
    );

    // 2. Check if Deadlines worker already finished
    const isDeadlinesDone = await this.redis.exists(
      FAN_IN_KEYS.deadlinesDone(meetingId),
    );

    if (isDeadlinesDone) {
      this.logger.log(`[${meetingId}] Both insights done — consolidating`);
      const hasPartial = summaryResult.fallback;
      await this.meetingState.setCompleted(meetingId, hasPartial);
    } else {
      this.logger.log(`[${meetingId}] Summary done — waiting for deadlines`);
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<JobPayload> | undefined, err: Error): Promise<void> {
    if (!job) return;
    // Summary worker never truly "fails" the pipeline — it uses fallback
    // This is called only for infrastructure failures (Redis down, etc.)
    this.logger.error(`[${job.data.meetingId}] Summary job infrastructure failure: ${err.message}`);
  }
}
