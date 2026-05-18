// =============================================================================
// TRANSCRIPTION PROCESSOR
// =============================================================================
// Consumes: transcription queue
// Produces: cleaning queue (on success)
//
// Resilience layers (inside-out):
//   Mock API call
//     ← withTimeout(5s)          stops runaway calls
//     ← CircuitBreaker.isAllowed  fails fast if API is down
//     ← withRetry(3 attempts)     handles transient errors
//     ← BullMQ attempts: 5        outer retry if job crashes entirely
// =============================================================================
import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import {
  QUEUE_NAMES,
  type JobPayload,
  type TranscriptionResult,
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
import { TranscriptionMockService } from './mock/transcription.mock';

const CB_CONFIG: CircuitBreakerConfig = {
  failureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD ?? '3', 10),
  cooldownMs: parseInt(process.env.CB_COOLDOWN_MS ?? '30000', 10),
};
const RETRY_OPTS = {
  attempts: parseInt(process.env.RETRY_ATTEMPTS ?? '3', 10),
  baseDelayMs: parseInt(process.env.RETRY_BASE_DELAY_MS ?? '1000', 10),
};
const TIMEOUT_MS = parseInt(process.env.TRANSCRIPTION_TIMEOUT_MS ?? '5000', 10);
const SERVICE = 'mock-transcription-api';
const STAGE = 'transcription';

@Processor(QUEUE_NAMES.TRANSCRIPTION)
export class TranscriptionProcessor extends WorkerHost {
  private readonly logger = new Logger(TranscriptionProcessor.name);

  constructor(
    private readonly mock: TranscriptionMockService,
    private readonly cb: CircuitBreakerService,
    private readonly idempotency: IdempotencyService,
    private readonly meetingState: MeetingStateService,
    @InjectQueue(QUEUE_NAMES.CLEANING) private readonly cleaningQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<JobPayload>): Promise<TranscriptionResult> {
    const { meetingId, idempotencyKey } = job.data;
    this.logger.log(`[${meetingId}] attempt #${job.attemptsMade + 1}`);

    // ── 1. Idempotency ─────────────────────────────────────────────────────
    // If we already processed this (BullMQ retry of a job that partially succeeded),
    // skip the work and just re-enqueue the next stage.
    const cached = await this.idempotency.get<TranscriptionResult>(
      STAGE,
      idempotencyKey,
    );
    if (cached) {
      this.logger.log(`[${meetingId}] Cache HIT — forwarding to cleaning`);
      await this.forwardToCleaning(job.data, cached);
      return cached;
    }

    // ── 2. Update meeting to PROCESSING ────────────────────────────────────
    await this.meetingState.setJobState(meetingId, MeetingStatus.PROCESSING);

    // ── 3. Resilience: CB → withRetry → withTimeout → Mock ─────────────────
    let result: TranscriptionResult;
    try {
      result = await withRetry(
        async () => {
          // Check circuit INSIDE retry so each attempt tests it
          await this.cb.isAllowed(SERVICE, CB_CONFIG);
          return withTimeout(
            this.mock.transcribe(job.data.rawAudioText),
            TIMEOUT_MS,
            'Transcription',
          );
        },
        RETRY_OPTS,
      );
      await this.cb.recordSuccess(SERVICE);
    } catch (err) {
      // Don't record circuit failure if circuit itself blocked the call
      if (!(err instanceof CircuitOpenError)) {
        await this.cb.recordFailure(SERVICE, CB_CONFIG);
      }
      throw err; // BullMQ will retry the whole job (outer retry)
    }

    // ── 4. Cache & persist ──────────────────────────────────────────────────
    await this.idempotency.set(STAGE, idempotencyKey, result);
    await this.meetingState.addPipelineResult(meetingId, 'transcription', result);

    // ── 5. Fan-forward ──────────────────────────────────────────────────────
    await this.forwardToCleaning(job.data, result);

    return result;
  }

  private async forwardToCleaning(
    payload: JobPayload,
    result: TranscriptionResult,
  ): Promise<void> {
    await this.cleaningQueue.add(
      'process',
      { ...payload, transcription: result },
      {
        jobId: `${payload.meetingId}-cleaning`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 100 },
        removeOnFail: false,
      },
    );
  }

  // Called ONLY when BullMQ exhausts ALL outer retry attempts → job goes to DLQ
  @OnWorkerEvent('failed')
  async onFailed(job: Job<JobPayload> | undefined, err: Error): Promise<void> {
    if (!job) return;
    const msg =
      err instanceof MaxRetriesExceededError
        ? `Inner retries exhausted: ${err.lastError.message}`
        : err.message;
    await this.meetingState.setFailed(job.data.meetingId, msg);
    this.logger.error(`[${job.data.meetingId}] Job sent to DLQ: ${msg}`);
  }
}
