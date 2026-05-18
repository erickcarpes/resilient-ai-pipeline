// =============================================================================
// MEETINGS SERVICE — Business Logic
// =============================================================================
// Orchestrates: Meeting entity creation + BullMQ job enqueue.
//
// Key design decisions:
//
// 1. HTTP-level idempotency:
//    If client sends the same meetingId twice, we return the existing meeting
//    (HTTP 200) instead of creating a duplicate job. This prevents double-billing
//    if the client's network fails and they retry the POST.
//
// 2. We return 202 ACCEPTED (not 201 CREATED) because the processing is async.
//    The meeting is "accepted for processing", not yet "created" in the
//    meaningful sense. This is the correct HTTP semantics for async workflows.
//
// 3. BullMQ job options we set explicitly (don't let defaults surprise you):
//    - jobId: = meetingId → prevents the same meeting from being enqueued twice
//    - attempts: 5       → BullMQ-level retry (outer layer)
//    - backoff: exponential → grows the wait time between retries
//    - removeOnComplete: false → keep job in Bull Board after success (visibility)
//    - removeOnFail: false    → keep failed jobs as our DLQ (inspectable)
// =============================================================================

import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { QUEUE_NAMES, type JobPayload } from '@pipeline/shared';
import { Meeting, MeetingStatus } from './entities/meeting.entity';
import type { IMeetingRepository } from './repositories/meeting.repository';
import { MEETING_REPOSITORY } from './repositories/meeting.repository';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import {
  MeetingStatusDto,
  MeetingSubmittedDto,
} from './dto/meeting-response.dto';

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    @Inject(MEETING_REPOSITORY)
    private readonly meetingRepository: IMeetingRepository,

    // @InjectQueue uses the queue name string to find the registered BullMQ queue.
    // Must match BullModule.registerQueue({ name: QUEUE_NAMES.TRANSCRIPTION })
    @InjectQueue(QUEUE_NAMES.TRANSCRIPTION)
    private readonly transcriptionQueue: Queue,
  ) {}

  /**
   * Submits a meeting for pipeline processing.
   *
   * Idempotency: if meetingId is provided and already exists, returns
   * existing state (HTTP 200). Otherwise creates and returns 202.
   */
  async submit(dto: CreateMeetingDto): Promise<MeetingSubmittedDto> {
    const meetingId = dto.meetingId ?? randomUUID();

    // ── HTTP-level idempotency check ─────────────────────────────────────────
    const existing = await this.meetingRepository.findById(meetingId);
    if (existing) {
      this.logger.log(
        `[${meetingId}] Idempotent request — returning existing meeting state`,
      );
      return {
        meetingId: existing.id,
        status: existing.status,
        message: 'Meeting already submitted. Check current status.',
        checkAt: `/meetings/${existing.id}`,
        isDuplicate: true,
      };
    }

    // ── Create the Meeting entity ─────────────────────────────────────────────
    const now = new Date().toISOString();
    const idempotencyKey = `${meetingId}:1`; // Format: "{meetingId}:{attempt}"

    const meeting: Meeting = {
      id: meetingId,
      title: dto.title,
      participants: dto.participants,
      rawAudioText: dto.rawAudioText,
      status: MeetingStatus.PENDING,
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
    };

    await this.meetingRepository.save(meeting);

    // ── Enqueue the pipeline job ──────────────────────────────────────────────
    const payload: JobPayload = {
      meetingId,
      idempotencyKey,
      rawAudioText: dto.rawAudioText,
      submittedAt: now,
    };

    await this.transcriptionQueue.add('process', payload, {
      // Using meetingId as BullMQ jobId prevents enqueueing the same meeting twice.
      // If a job with this ID already exists, BullMQ silently ignores the duplicate.
      jobId: meetingId,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000, // base delay: 1s, 2s, 4s, 8s, 16s
      },
      // Keep jobs visible in Bull Board after completion/failure
      removeOnComplete: { count: 100 }, // Keep last 100 completed
      removeOnFail: false, // Never remove failed jobs (our DLQ)
    });

    this.logger.log(`[${meetingId}] Meeting submitted → transcription queue`);

    return {
      meetingId,
      status: MeetingStatus.PENDING,
      message: 'Meeting accepted for processing',
      checkAt: `/meetings/${meetingId}`,
    };
  }

  /**
   * Returns the current state of a meeting by ID.
   * Workers call the repository directly to update pipeline results —
   * the gateway exposes this read-only view to the client.
   */
  async findById(id: string): Promise<MeetingStatusDto> {
    const meeting = await this.meetingRepository.findById(id);
    if (!meeting) {
      throw new NotFoundException(`Meeting ${id} not found`);
    }
    return MeetingStatusDto.fromEntity(meeting);
  }
}
