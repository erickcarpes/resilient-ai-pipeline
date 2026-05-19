import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SharedModule, QUEUE_NAMES } from '@pipeline/shared';
import { TranscriptionProcessor } from './transcription.processor';
import { TranscriptionMockService } from './mock/transcription.mock';
import { ResilienceService } from '../services/resilience.service';
import { TranscriptionService } from '../services/transcription.service';
import { WorkflowService } from '../services/workflow.service';

@Module({
  imports: [
    SharedModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.CLEANING }),
  ],
  providers: [
    TranscriptionProcessor,
    TranscriptionMockService,
    ResilienceService,
    TranscriptionService,
    WorkflowService,
  ],
})
export class TranscriptionModule {}
