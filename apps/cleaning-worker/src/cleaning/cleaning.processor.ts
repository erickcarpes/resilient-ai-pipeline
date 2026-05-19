import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  QUEUE_NAMES,
  type JobPayload,
  type CleaningResult,
  IdempotencyService,
  MaxRetriesExceededError,
} from '@pipeline/shared';
import { CleaningService } from '../services/cleaning.service';
import { WorkflowService } from '../services/workflow.service';
import {
  finalizeObservability,
  recordFailure,
  recordIdempotencyHit,
  recordNextStageEnqueued,
  recordSuccess,
  startJobObservability,
} from '../observability/cleaning.observability';
const STAGE = 'cleaning';

@Processor(QUEUE_NAMES.CLEANING, { concurrency: 2 })
export class CleaningProcessor extends WorkerHost {
  private readonly logger = new Logger(CleaningProcessor.name);

  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly cleaningService: CleaningService,
    private readonly workflow: WorkflowService,
  ) {
    super();
  }

  async process(job: Job<JobPayload>): Promise<CleaningResult> {
    const { meetingId, idempotencyKey } = job.data;
    this.logger.log(`[${meetingId}] Cleaning attempt #${job.attemptsMade + 1}`);

    const observability = startJobObservability(job, meetingId);
    let succeeded = false;

    const cached = await this.idempotency.get<CleaningResult>(
      STAGE,
      idempotencyKey,
    );
    if (cached) {
      recordIdempotencyHit(observability);
      this.logger.log(`[${meetingId}] Cache HIT — fan-out to insights`);
      await this.workflow.fanOut(job.data, cached);
      recordNextStageEnqueued(observability, 2);
      succeeded = true;
      return cached;
    }

    try {
      await this.workflow.markProcessing(meetingId);

      const result = await this.cleaningService.clean(job.data);

      await this.idempotency.set(STAGE, idempotencyKey, result);
      await this.workflow.persistCleaningResult(meetingId, result);

      await this.workflow.fanOut(job.data, result);
      recordNextStageEnqueued(observability, 2);
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

  @OnWorkerEvent('failed')
  async onFailed(job: Job<JobPayload> | undefined, err: Error): Promise<void> {
    if (!job) return;
    const msg =
      err instanceof MaxRetriesExceededError
        ? err.lastError.message
        : err.message;
    await this.workflow.markFailed(job.data.meetingId, msg);
  }
}
