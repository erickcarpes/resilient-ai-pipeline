import { Module } from '@nestjs/common';
import { QUEUE_NAMES, SharedModule } from '@pipeline/shared';
import { BullModule } from '@nestjs/bullmq';
import { SummaryProcessor } from './summary.processor';
import { SummaryMockService } from './mock/summary.mock';

@Module({
  imports: [
    SharedModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.INSIGHTS_SUMMARY }),
  ],
  providers: [SummaryProcessor, SummaryMockService],
})
export class SummaryModule {}
