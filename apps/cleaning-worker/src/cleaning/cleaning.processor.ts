import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  QUEUE_NAMES,
  type JobPayload,
  type CleaningResult,
  IdempotencyService,
  MaxRetriesExceededError,
  AppLogger,
} from '@pipeline/shared';
import { CleaningService } from '../services/cleaning.service';
import { WorkflowService } from '../services/workflow.service';
const STAGE = 'cleaning';

@Processor(QUEUE_NAMES.CLEANING, { concurrency: 2 })
export class CleaningProcessor extends WorkerHost {
  private readonly logger: AppLogger;

  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly cleaningService: CleaningService,
    private readonly workflow: WorkflowService,
    baseLogger: AppLogger,
  ) {
    super();
    this.logger = baseLogger.child({
      component: 'cleaning.processor',
    });
  }

  async process(job: Job<JobPayload>): Promise<CleaningResult> {
    const { meetingId, idempotencyKey } = job.data;

    this.logger.info({
      event: 'JOB_STARTED',
      meetingId,
      idempotencyKey,
      attemptsMade: job.attemptsMade,
    });

    // Step 1: idempotency short-circuit (avoid duplicate work on retries).
    const cached = await this.idempotency.get<CleaningResult>(
      STAGE,
      idempotencyKey,
    );
    if (cached) {
      this.logger.info({
        event: 'IDEMPOTENCY_HIT',
        meetingId,
      });
      await this.workflow.fanOut(job.data, cached);
      return cached;
    }

    // Step 2: mark pipeline state as processing.
    await this.workflow.markProcessing(meetingId, STAGE);

    // Step 3: run the resilient cleaning call (CB + timeout).
    const result = await this.cleaningService.clean(job.data);

    // Step 4: cache + persist the result for idempotency and API reads.
    await this.idempotency.set(STAGE, idempotencyKey, result);
    await this.workflow.persistCleaningResult(meetingId, result);

    // Step 5: fan-out to both insights queues.
    await this.workflow.fanOut(job.data, result);

    this.logger.info({
      event: 'JOB_COMPLETED',
      meetingId,
    });

    return result;
  }

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
