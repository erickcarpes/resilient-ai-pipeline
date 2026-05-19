import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  QUEUE_NAMES,
  type JobPayload,
  type SummaryResult,
  IdempotencyService,
} from '@pipeline/shared';
import { SummaryService } from '../services/summary.service';
import { WorkflowService } from '../services/workflow.service';
import {
  finalizeObservability,
  recordFailure,
  recordIdempotencyHit,
  recordSuccess,
  startJobObservability,
} from '../observability/summary.observability';
const STAGE = 'summary';

@Processor(QUEUE_NAMES.INSIGHTS_SUMMARY, { concurrency: 2 })
export class SummaryProcessor extends WorkerHost {
  private readonly logger = new Logger(SummaryProcessor.name);

  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly summaryService: SummaryService,
    private readonly workflow: WorkflowService,
  ) {
    super();
  }

  async process(job: Job<JobPayload>): Promise<SummaryResult> {
    const { meetingId, idempotencyKey } = job.data;
    this.logger.log(`[${meetingId}] Summary attempt #${job.attemptsMade + 1}`);

    const observability = startJobObservability(job, meetingId);
    let succeeded = false;

    const cached = await this.idempotency.get<SummaryResult>(
      STAGE,
      idempotencyKey,
    );
    if (cached) {
      recordIdempotencyHit(observability);
      this.logger.log(
        `[${meetingId}] Summary cache HIT — running Fan-In check`,
      );
      await this.workflow.fanIn(meetingId, cached);
      succeeded = true;
      return cached;
    }

    try {
      const result = await this.summaryService.extract(job.data);
      if (result.fallback) {
        this.logger.warn(`[${meetingId}] Summary failed — using fallback`);
      }

      await this.idempotency.set(STAGE, idempotencyKey, result);
      await this.workflow.persistSummaryResult(meetingId, result);

      // ── FAN-IN ───────────────────────────────────────────────────────────
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
    // Summary worker never truly "fails" the pipeline — it uses fallback
    // This is called only for infrastructure failures (Redis down, etc.)
    this.logger.error(
      `[${job.data.meetingId}] Summary job infrastructure failure: ${err.message}`,
    );
  }
}
