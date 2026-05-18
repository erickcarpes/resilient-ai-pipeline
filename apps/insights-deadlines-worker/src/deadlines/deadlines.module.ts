import { Module } from '@nestjs/common';
import { QUEUE_NAMES, SharedModule } from '@pipeline/shared';
import { BullModule } from '@nestjs/bullmq';
import { DeadlinesProcessor } from './deadlines.processor';
import { DeadlinesMockService } from './mock/deadlines.mock';

@Module({
  imports: [
    SharedModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.INSIGHTS_DEADLINES }),
  ],
  providers: [DeadlinesProcessor, DeadlinesMockService],
})
export class DeadlinesModule {}
