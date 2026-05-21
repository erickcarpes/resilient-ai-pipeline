import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import {
  JobPayload,
  MeetingStateService,
  MeetingStatus,
  QUEUE_NAMES,
  type TranscriptionResult,
  AppLogger,
} from '@pipeline/shared';
import { Queue } from 'bullmq';

@Injectable()
export class WorkflowService {
  private readonly logger: AppLogger;

  constructor(
    private readonly meetingState: MeetingStateService,
    @InjectQueue(QUEUE_NAMES.CLEANING) private readonly cleaningQueue: Queue,
    baseLogger: AppLogger,
  ) {
    this.logger = baseLogger.child({ component: 'transcription.workflow' });
  }

  async markProcessing(meetingId: string, stage: string): Promise<void> {
    this.logger.info({ event: 'PIPELINE_STATE_PROCESSING', meetingId, stage });
    await this.meetingState.setJobState(meetingId, MeetingStatus.PROCESSING);
  }

  async persistTranscriptionResult(
    meetingId: string,
    result: TranscriptionResult,
  ): Promise<void> {
    await this.meetingState.addPipelineResult(
      meetingId,
      'transcription',
      result,
    );
  }

  async enqueueCleaning(
    payload: JobPayload,
    result: TranscriptionResult,
  ): Promise<void> {
    await this.cleaningQueue.add(
      'process',
      { ...payload, transcription: result },
      {
        jobId: `${payload.meetingId}-cleaning`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 100 },
        removeOnFail: false,
      },
    );
    this.logger.info({
      event: 'PIPELINE_STAGE_ENQUEUED',
      meetingId: payload.meetingId,
      nextStage: QUEUE_NAMES.CLEANING,
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
