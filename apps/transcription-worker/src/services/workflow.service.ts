import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import {
  JobPayload,
  MeetingStateService,
  MeetingStatus,
  QUEUE_NAMES,
  type TranscriptionResult,
} from '@pipeline/shared';
import { Queue } from 'bullmq';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly meetingState: MeetingStateService,
    @InjectQueue(QUEUE_NAMES.CLEANING) private readonly cleaningQueue: Queue,
  ) {}

  async markProcessing(meetingId: string): Promise<void> {
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
  }

  async markFailed(meetingId: string, reason: string): Promise<void> {
    await this.meetingState.setFailed(meetingId, reason);
  }
}
