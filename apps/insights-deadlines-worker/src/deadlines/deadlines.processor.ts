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
const STAGE = 'deadlines';

@Processor(QUEUE_NAMES.INSIGHTS_DEADLINES, { concurrency: 2 })
export class DeadlinesProcessor extends WorkerHost {
  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly deadlinesService: DeadlinesService,
    private readonly workflow: WorkflowService,
  ) {
    super();
  }

  async process(job: Job<JobPayload>): Promise<DeadlinesResult> {
    const { meetingId, idempotencyKey } = job.data;

    // Step 1: idempotency short-circuit (avoid duplicate work on retries).
    const cached = await this.idempotency.get<DeadlinesResult>(
      STAGE,
      idempotencyKey,
    );
    if (cached) {
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

    return result;
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<JobPayload> | undefined, err: Error): Promise<void> {
    if (!job) return;
  }
}
