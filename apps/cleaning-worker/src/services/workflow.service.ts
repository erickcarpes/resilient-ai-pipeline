import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import {
  JobPayload,
  MeetingStateService,
  MeetingStatus,
  QUEUE_NAMES,
  type CleaningResult,
} from '@pipeline/shared';
import { Queue } from 'bullmq';

const FAN_OUT_JOB_OPTS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { count: 100 },
  removeOnFail: false,
};

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly meetingState: MeetingStateService,
    @InjectQueue(QUEUE_NAMES.INSIGHTS_SUMMARY)
    private readonly summaryQueue: Queue,
    @InjectQueue(QUEUE_NAMES.INSIGHTS_DEADLINES)
    private readonly deadlinesQueue: Queue,
  ) {}

  async markProcessing(meetingId: string): Promise<void> {
    await this.meetingState.setJobState(meetingId, MeetingStatus.PROCESSING);
  }

  async persistCleaningResult(
    meetingId: string,
    result: CleaningResult,
  ): Promise<void> {
    await this.meetingState.addPipelineResult(meetingId, 'cleaning', result);
  }

  async fanOut(payload: JobPayload, result: CleaningResult): Promise<void> {
    const enriched = { ...payload, cleaning: result };
    const { meetingId } = payload;

    await Promise.all([
      this.summaryQueue.add('process', enriched, {
        jobId: `${meetingId}-summary`,
        ...FAN_OUT_JOB_OPTS,
      }),
      this.deadlinesQueue.add('process', enriched, {
        jobId: `${meetingId}-deadlines`,
        ...FAN_OUT_JOB_OPTS,
      }),
    ]);

    this.logger.log(
      `[${meetingId}] Fan-Out → insights-summary + insights-deadlines`,
    );
  }

  async markFailed(meetingId: string, reason: string): Promise<void> {
    await this.meetingState.setFailed(meetingId, reason);
  }
}
