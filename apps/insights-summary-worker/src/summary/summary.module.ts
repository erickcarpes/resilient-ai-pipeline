import { Module } from '@nestjs/common';
import { QUEUE_NAMES, SharedModule } from '@pipeline/shared';
import { BullModule } from '@nestjs/bullmq';
import { SummaryProcessor } from './summary.processor';
import { SummaryMockService } from './mock/summary.mock';
import { ResilienceService } from '../services/resilience.service';
import { SummaryService } from '../services/summary.service';
import { WorkflowService } from '../services/workflow.service';

@Module({
  imports: [
    SharedModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.INSIGHTS_SUMMARY }),
  ],
  providers: [
    SummaryProcessor,
    SummaryMockService,
    ResilienceService,
    SummaryService,
    WorkflowService,
  ],
})
export class SummaryModule {}
