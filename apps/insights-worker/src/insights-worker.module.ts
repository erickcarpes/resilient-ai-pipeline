import { Module } from '@nestjs/common';
import { InsightsWorkerController } from './insights-worker.controller';
import { InsightsWorkerService } from './insights-worker.service';

@Module({
  imports: [],
  controllers: [InsightsWorkerController],
  providers: [InsightsWorkerService],
})
export class InsightsWorkerModule {}
