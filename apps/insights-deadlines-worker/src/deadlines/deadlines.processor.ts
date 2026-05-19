import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  QUEUE_NAMES,
  type JobPayload,
  type DeadlinesResult,
  IdempotencyService,
} from '@pipeline/shared';
import { DeadlinesService } from '../services/deadlines.service';
import { WorkflowService } from '../services/workflow.service';
import {
  finalizeObservability,
  recordFailure,
  recordIdempotencyHit,
  recordSuccess,
  startJobObservability,
} from '../observability/deadlines.observability';
const STAGE = 'deadlines';

@Processor(QUEUE_NAMES.INSIGHTS_DEADLINES, { concurrency: 2 })
export class DeadlinesProcessor extends WorkerHost {
  private readonly logger = new Logger(DeadlinesProcessor.name);

  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly deadlinesService: DeadlinesService,
    private readonly workflow: WorkflowService,
  ) {
    super();
  }

  async process(job: Job<JobPayload>): Promise<DeadlinesResult> {
    const { meetingId, idempotencyKey } = job.data;
    this.logger.log(
      `[${meetingId}] Deadlines attempt #${job.attemptsMade + 1}`,
    );

    const observability = startJobObservability(job, meetingId);
    let succeeded = false;

    const cached = await this.idempotency.get<DeadlinesResult>(
      STAGE,
      idempotencyKey,
    );
    if (cached) {
      recordIdempotencyHit(observability);
      await this.workflow.fanIn(meetingId, cached);
      succeeded = true;
      return cached;
    }

    try {
      const result = await this.deadlinesService.extract(job.data);
      if (result.fallback) {
        this.logger.warn(`[${meetingId}] Deadlines failed — using fallback`);
      }

      await this.idempotency.set(STAGE, idempotencyKey, result);
      await this.workflow.persistDeadlinesResult(meetingId, result);
      await this.workflow.fanIn(meetingId, result);

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
    this.logger.error(
      `[${job.data.meetingId}] Deadlines infrastructure failure: ${err.message}`,
    );
  }
}
