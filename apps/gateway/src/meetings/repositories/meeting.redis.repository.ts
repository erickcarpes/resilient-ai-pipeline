// =============================================================================
// MEETING REDIS REPOSITORY — Concrete Implementation
// =============================================================================
// Stores Meeting entities as JSON strings in Redis.
//
// KEY FORMAT: meeting:{meetingId}
// NO TTL: Meetings persist indefinitely (unlike idempotency cache which expires)
//
// In production you'd use PostgreSQL here. The interface contract guarantees
// that swapping implementations requires zero changes to MeetingsService.
// =============================================================================

import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@pipeline/shared';
import type {
  SummaryResult,
  DeadlinesResult,
  TranscriptionResult,
  CleaningResult,
} from '@pipeline/shared';
import { Meeting, MeetingStatus } from '../entities/meeting.entity';
import { IMeetingRepository } from './meeting.repository';

@Injectable()
export class MeetingRedisRepository implements IMeetingRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private key(id: string): string {
    return `meeting:${id}`;
  }

  async save(meeting: Meeting): Promise<void> {
    await this.redis.set(this.key(meeting.id), JSON.stringify(meeting));
  }

  async findById(id: string): Promise<Meeting | null> {
    const raw = await this.redis.get(this.key(id));
    if (!raw) return null;
    return JSON.parse(raw) as Meeting;
  }

  async updateStatus(
    id: string,
    status: MeetingStatus,
    error?: string,
  ): Promise<void> {
    const meeting = await this.findById(id);
    if (!meeting) return;

    meeting.status = status;
    meeting.updatedAt = new Date().toISOString();
    if (error) meeting.error = error;

    await this.save(meeting);
  }

  async updatePipelineResult(
    id: string,
    stage: 'transcription' | 'cleaning' | 'summary' | 'deadlines',
    result:
      | TranscriptionResult
      | CleaningResult
      | SummaryResult
      | DeadlinesResult,
  ): Promise<void> {
    const meeting = await this.findById(id);
    if (!meeting) return;

    meeting.pipeline = meeting.pipeline ?? {};
    // TypeScript needs a cast here because of the union type on stage
    (meeting.pipeline as Record<string, unknown>)[stage] = result;
    meeting.updatedAt = new Date().toISOString();

    await this.save(meeting);
  }
}
