import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import {
  JobPayload,
  MeetingStateService,
  MeetingStatus,
  QUEUE_NAMES,
  type CleaningResult,
  AppLogger,
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
  private readonly logger: AppLogger;

  constructor(
    private readonly meetingState: MeetingStateService,
    @InjectQueue(QUEUE_NAMES.INSIGHTS_SUMMARY)
    private readonly summaryQueue: Queue,
    @InjectQueue(QUEUE_NAMES.INSIGHTS_DEADLINES)
    private readonly deadlinesQueue: Queue,
    baseLogger: AppLogger,
  ) {
    this.logger = baseLogger.child({ component: 'cleaning.workflow' });
  }

  async markProcessing(meetingId: string, stage: string): Promise<void> {
    this.logger.info({ event: 'PIPELINE_STATE_PROCESSING', meetingId, stage });
    await this.meetingState.setJobState(meetingId, MeetingStatus.PROCESSING);
  }

  async persistCleaningResult(
    meetingId: string,
    result: CleaningResult,
  ): Promise<void> {
    await this.meetingState.addPipelineResult(meetingId, 'cleaning', result);
  }

  async fanOut(payload: JobPayload, result: CleaningResult): Promise<void> {
    const { meetingId } = payload;

    await Promise.all([
      this.summaryQueue.add(
        'process',
        { ...payload, cleaning: result },
        {
          jobId: `${meetingId}-summary`,
          ...FAN_OUT_JOB_OPTS,
        },
      ),
      this.deadlinesQueue.add(
        'process',
        { ...payload, cleaning: result },
        {
          jobId: `${meetingId}-deadlines`,
          ...FAN_OUT_JOB_OPTS,
        },
      ),
    ]);

    this.logger.info({
      event: 'PIPELINE_FAN_OUT',
      meetingId,
    });
  }

  async markFailed(
    meetingId: string,
    reason: string,
    stage: string,
  ): Promise<void> {
    this.logger.error({
      event: 'PIPELINE_STATE_FAILED',
      meetingId,
      stage,
      reason,
    });
    await this.meetingState.setFailed(meetingId, reason);
  }
}
