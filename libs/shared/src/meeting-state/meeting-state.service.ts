// =============================================================================
// MEETING STATE SERVICE — Workers use this to report progress to Redis
// =============================================================================
// Each worker calls this service after completing its stage.
// The gateway reads the same Redis key when the client polls GET /meetings/:id.
// =============================================================================
import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { Meeting, MeetingStatus } from '../models/meeting.models';
import type {
  TranscriptionResult,
  CleaningResult,
  SummaryResult,
  DeadlinesResult,
} from '../models/job.models';

type PipelineStage = 'transcription' | 'cleaning' | 'summary' | 'deadlines';
type PipelineResult =
  | TranscriptionResult
  | CleaningResult
  | SummaryResult
  | DeadlinesResult;

@Injectable()
export class MeetingStateService {
  private readonly logger = new Logger(MeetingStateService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private key(id: string) {
    return `meeting:${id}`;
  }

  async get(id: string): Promise<Meeting | null> {
    const raw = await this.redis.get(this.key(id));
    if (!raw) return null;
    return JSON.parse(raw) as Meeting;
  }

  async setJobState(meetingId: string, status: MeetingStatus): Promise<void> {
    const meeting = await this.get(meetingId);
    if (!meeting) return;
    meeting.status = status;
    meeting.updatedAt = new Date().toISOString();
    await this.redis.set(this.key(meetingId), JSON.stringify(meeting));
    this.logger.log(`[${meetingId}] State → ${status}`);
  }

  async addPipelineResult(
    meetingId: string,
    stage: PipelineStage,
    result: PipelineResult,
  ): Promise<void> {
    const meeting = await this.get(meetingId);
    if (!meeting) return;
    meeting.pipeline = meeting.pipeline ?? {};
    (meeting.pipeline as Record<string, unknown>)[stage] = result;
    meeting.updatedAt = new Date().toISOString();
    await this.redis.set(this.key(meetingId), JSON.stringify(meeting));
  }

  async setFailed(meetingId: string, error: string): Promise<void> {
    const meeting = await this.get(meetingId);
    if (!meeting) return;
    meeting.status = MeetingStatus.FAILED;
    meeting.error = error;
    meeting.updatedAt = new Date().toISOString();
    await this.redis.set(this.key(meetingId), JSON.stringify(meeting));
    this.logger.error(`[${meetingId}] FAILED: ${error}`);
  }

  async setCompleted(meetingId: string, hasPartial: boolean): Promise<void> {
    const meeting = await this.get(meetingId);
    if (!meeting) return;
    meeting.status = hasPartial ? MeetingStatus.PARTIAL : MeetingStatus.COMPLETED;
    meeting.updatedAt = new Date().toISOString();
    await this.redis.set(this.key(meetingId), JSON.stringify(meeting));
    this.logger.log(`[${meetingId}] Pipeline → ${meeting.status}`);
  }
}
