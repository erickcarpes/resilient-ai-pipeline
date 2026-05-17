// =============================================================================
// MEETINGS MODULE
// =============================================================================
// Wires together the meetings slice: controller, service, repository, and queue.
//
// Notice the repository provider pattern:
//   { provide: MEETING_REPOSITORY, useClass: MeetingRedisRepository }
//
// This is Dependency Inversion in action:
//   - MeetingsService depends on the MEETING_REPOSITORY token (interface)
//   - The module decides WHICH implementation to provide
//   - To swap to Postgres: change `useClass` here — service untouched
// =============================================================================

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { QUEUE_NAMES } from '@pipeline/shared';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { MeetingRedisRepository } from './repositories/meeting.redis.repository';
import { MEETING_REPOSITORY } from './repositories/meeting.repository';

@Module({
  imports: [
    // Register the transcription queue so @InjectQueue works in MeetingsService.
    // BullModule.forRootAsync (in AppModule) provides the Redis connection.
    BullModule.registerQueue({ name: QUEUE_NAMES.TRANSCRIPTION }),

    // Register all queues with Bull Board for the /queues dashboard.
    // Even though the gateway only PRODUCES to transcription:queue,
    // we register all queues here so Bull Board can monitor the full pipeline.
    BullModule.registerQueue(
      { name: QUEUE_NAMES.CLEANING },
      { name: QUEUE_NAMES.INSIGHTS_SUMMARY },
      { name: QUEUE_NAMES.INSIGHTS_DEADLINES },
    ),

    BullBoardModule.forFeature(
      { name: QUEUE_NAMES.TRANSCRIPTION, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.CLEANING, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.INSIGHTS_SUMMARY, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.INSIGHTS_DEADLINES, adapter: BullMQAdapter },
    ),
  ],
  controllers: [MeetingsController],
  providers: [
    MeetingsService,
    // Bind the interface token to the concrete Redis implementation
    {
      provide: MEETING_REPOSITORY,
      useClass: MeetingRedisRepository,
    },
  ],
})
export class MeetingsModule {}
