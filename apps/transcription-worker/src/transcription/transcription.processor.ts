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
//     ← BullMQ attempts: 5        outer retry if job crashes entirely
// =============================================================================
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  QUEUE_NAMES,
  type JobPayload,
  type TranscriptionResult,
  IdempotencyService,
  MaxRetriesExceededError,
  AppLogger,
} from '@pipeline/shared';
import { TranscriptionService } from '../services/transcription.service';
import { WorkflowService } from '../services/workflow.service';
const STAGE = 'transcription';

@Processor(QUEUE_NAMES.TRANSCRIPTION, { concurrency: 5 })
export class TranscriptionProcessor extends WorkerHost {
  private readonly logger: AppLogger;

  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly transcriptionService: TranscriptionService,
    private readonly workflow: WorkflowService,
    baseLogger: AppLogger,
  ) {
    super();
    this.logger = baseLogger.child({
      component: 'transcription.processor',
    });
  }

  async process(job: Job<JobPayload>): Promise<TranscriptionResult> {
    const { meetingId, idempotencyKey } = job.data;

    this.logger.info({
      event: 'JOB_STARTED',
      meetingId,
      idempotencyKey,
      attemptsMade: job.attemptsMade,
    });

    // Step 1: idempotency short-circuit (avoid duplicate work on retries).
    const cached = await this.idempotency.get<TranscriptionResult>(
      STAGE,
      idempotencyKey,
    );
    if (cached) {
      this.logger.info({
        event: 'IDEMPOTENCY_HIT',
        meetingId,
      });
      await this.workflow.enqueueCleaning(job.data, cached);
      return cached;
    }

    // Step 2: mark pipeline state as processing.
    await this.workflow.markProcessing(meetingId, STAGE);

    // Step 3: run the resilient transcription call (CB + timeout).
    const result = await this.transcriptionService.transcribe(job.data);

    // Step 4: cache + persist the result for idempotency and API reads.
    await this.idempotency.set(STAGE, idempotencyKey, result);
    await this.workflow.persistTranscriptionResult(meetingId, result);

    // Step 5: enqueue the next stage (cleaning).
    await this.workflow.enqueueCleaning(job.data, result);

    this.logger.info({
      event: 'JOB_COMPLETED',
      meetingId,
    });

    return result;
  }

  // Called ONLY when BullMQ exhausts ALL outer retry attempts → job goes to DLQ
  @OnWorkerEvent('failed')
  async onFailed(job: Job<JobPayload> | undefined, err: Error): Promise<void> {
    if (!job) return;
    const msg =
      err instanceof MaxRetriesExceededError
        ? err.lastError.message
        : err.message;

    await this.workflow.markFailed(job.data.meetingId, msg, STAGE);
  }
}
