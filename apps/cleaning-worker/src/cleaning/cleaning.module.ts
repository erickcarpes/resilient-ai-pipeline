import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SharedModule, QUEUE_NAMES } from '@pipeline/shared';
import { CleaningProcessor } from './cleaning.processor';
import { CleaningMockService } from './mock/cleaning.mock';
import { ResilienceService } from '../services/resilience.service';
import { CleaningService } from '../services/cleaning.service';
import { WorkflowService } from '../services/workflow.service';

@Module({
  imports: [
    SharedModule,
    BullModule.registerQueue(
      { name: QUEUE_NAMES.INSIGHTS_SUMMARY },
      { name: QUEUE_NAMES.INSIGHTS_DEADLINES },
    ),
  ],
  providers: [
    CleaningProcessor,
    CleaningMockService,
    ResilienceService,
    CleaningService,
    WorkflowService,
  ],
})
export class CleaningModule {}
