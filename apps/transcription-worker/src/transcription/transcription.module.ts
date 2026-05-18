import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SharedModule, QUEUE_NAMES } from '@pipeline/shared';
import { TranscriptionProcessor } from './transcription.processor';
import { TranscriptionMockService } from './mock/transcription.mock';

@Module({
  imports: [
    SharedModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.CLEANING }),
  ],
  providers: [TranscriptionProcessor, TranscriptionMockService],
})
export class TranscriptionModule {}
