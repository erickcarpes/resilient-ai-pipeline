import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SharedModule, QUEUE_NAMES } from '@pipeline/shared';
import { CleaningProcessor } from './cleaning.processor';
import { CleaningMockService } from './mock/cleaning.mock';

@Module({
  imports: [
    SharedModule,
    BullModule.registerQueue(
      { name: QUEUE_NAMES.INSIGHTS_SUMMARY },
      { name: QUEUE_NAMES.INSIGHTS_DEADLINES },
    ),
  ],
  providers: [CleaningProcessor, CleaningMockService],
})
export class CleaningModule {}
