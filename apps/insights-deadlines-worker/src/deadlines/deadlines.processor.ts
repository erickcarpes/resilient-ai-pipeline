import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  QUEUE_NAMES,
  type JobPayload,
  type DeadlinesResult,
  IdempotencyService,
  AppLogger,
} from '@pipeline/shared';
import { DeadlinesService } from '../services/deadlines.service';
import { WorkflowService } from '../services/workflow.service';
const STAGE = 'deadlines';

@Processor(QUEUE_NAMES.INSIGHTS_DEADLINES, { concurrency: 2 })
export class DeadlinesProcessor extends WorkerHost {
  private readonly logger: AppLogger;

  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly deadlinesService: DeadlinesService,
    private readonly workflow: WorkflowService,
    baseLogger: AppLogger,
  ) {
    super();
    this.logger = baseLogger.child({
      component: 'deadlines.processor',
    });
  }

  async process(job: Job<JobPayload>): Promise<DeadlinesResult> {
    const { meetingId, idempotencyKey } = job.data;

    this.logger.info({
      event: 'JOB_STARTED',
      meetingId,
      idempotencyKey,
      attemptsMade: job.attemptsMade,
    });

    // Step 1: idempotency short-circuit (avoid duplicate work on retries).
    const cached = await this.idempotency.get<DeadlinesResult>(
      STAGE,
      idempotencyKey,
    );
    if (cached) {
      this.logger.info({
        event: 'IDEMPOTENCY_HIT',
        meetingId,
      });
      await this.workflow.fanIn(meetingId, cached);
      return cached;
    }

    // Step 2: extract deadlines (CB + timeout), fallback if needed.
    const result = await this.deadlinesService.extract(job.data);

    // Step 3: cache + persist the result for API reads.
    await this.idempotency.set(STAGE, idempotencyKey, result);
    await this.workflow.persistDeadlinesResult(meetingId, result);

    // Step 4: fan-in coordination (second finisher consolidates state).
    await this.workflow.fanIn(meetingId, result);

    this.logger.info({
      event: 'JOB_COMPLETED',
      meetingId,
    });

    return result;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<JobPayload> | undefined, err: Error): void {
    if (!job) return;
    this.logger.error({
      event: 'JOB_FAILED',
      meetingId: job.data.meetingId,
      reason: err.message,
    });
  }
}
