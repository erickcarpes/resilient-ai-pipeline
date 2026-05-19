import { Module } from '@nestjs/common';
import { QUEUE_NAMES, SharedModule } from '@pipeline/shared';
import { BullModule } from '@nestjs/bullmq';
import { DeadlinesProcessor } from './deadlines.processor';
import { DeadlinesMockService } from './mock/deadlines.mock';
import { ResilienceService } from '../services/resilience.service';
import { DeadlinesService } from '../services/deadlines.service';
import { WorkflowService } from '../services/workflow.service';

@Module({
  imports: [
    SharedModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.INSIGHTS_DEADLINES }),
  ],
  providers: [
    DeadlinesProcessor,
    DeadlinesMockService,
    ResilienceService,
    DeadlinesService,
    WorkflowService,
  ],
})
export class DeadlinesModule {}
