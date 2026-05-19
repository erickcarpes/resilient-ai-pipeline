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
import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  QUEUE_NAMES,
  type JobPayload,
  type TranscriptionResult,
  IdempotencyService,
  MaxRetriesExceededError,
} from '@pipeline/shared';
import { TranscriptionService } from '../services/transcription.service';
import { WorkflowService } from '../services/workflow.service';
import {
  finalizeObservability,
  recordFailure,
  recordIdempotencyHit,
  recordNextStageEnqueued,
  recordSuccess,
  startJobObservability,
} from '../observability/transcription.observability';
const STAGE = 'transcription';

@Processor(QUEUE_NAMES.TRANSCRIPTION, { concurrency: 5 })
export class TranscriptionProcessor extends WorkerHost {
  private readonly logger = new Logger(TranscriptionProcessor.name);

  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly transcriptionService: TranscriptionService,
    private readonly workflow: WorkflowService,
  ) {
    super();
  }

  async process(job: Job<JobPayload>): Promise<TranscriptionResult> {
    const { meetingId, idempotencyKey } = job.data;
    this.logger.log(`[${meetingId}] attempt #${job.attemptsMade + 1}`);

    // One context bundles metrics + tracing so the workflow stays easy to read.
    const observability = startJobObservability(job, meetingId);
    let succeeded = false;

    try {
      // ── 1. Idempotency ───────────────────────────────────────────────────
      // If we already processed this (BullMQ retry of a job that partially succeeded),
      // skip the work and just re-enqueue the next stage.
      const cached = await this.idempotency.get<TranscriptionResult>(
        STAGE,
        idempotencyKey,
      );
      if (cached) {
        recordIdempotencyHit(observability);
        this.logger.log(`[${meetingId}] Cache HIT — forwarding to cleaning`);
        await this.workflow.enqueueCleaning(job.data, cached);
        recordNextStageEnqueued(observability);
        succeeded = true;
        return cached;
      }

      // ── 2. Update meeting to PROCESSING ──────────────────────────────────
      await this.workflow.markProcessing(meetingId);

      // ── 3. Resilience: CB → Timeout → Mock ───────────────────────────────
      // Encapsulated in a service so resilience rules are defined in one place.
      const result = await this.transcriptionService.transcribe(job.data);

      // ── 4. Cache & persist ───────────────────────────────────────────────
      await this.idempotency.set(STAGE, idempotencyKey, result);
      await this.workflow.persistTranscriptionResult(meetingId, result);

      // ── 5. Fan-forward ───────────────────────────────────────────────────
      await this.workflow.enqueueCleaning(job.data, result);
      recordNextStageEnqueued(observability);

      succeeded = true;
      return result;
    } catch (err) {
      recordFailure(observability, err as Error);
      throw err;
    } finally {
      if (succeeded) {
        recordSuccess(observability);
      }
      finalizeObservability(observability);
    }
  }

  // Called ONLY when BullMQ exhausts ALL outer retry attempts → job goes to DLQ
  @OnWorkerEvent('failed')
  async onFailed(job: Job<JobPayload> | undefined, err: Error): Promise<void> {
    if (!job) return;
    const msg =
      err instanceof MaxRetriesExceededError
        ? err.lastError.message
        : err.message;
    await this.workflow.markFailed(job.data.meetingId, msg);
    this.logger.error(`[${job.data.meetingId}] Job sent to DLQ: ${msg}`);
  }
}
