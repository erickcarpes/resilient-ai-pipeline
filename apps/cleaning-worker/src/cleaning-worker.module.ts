import { Module } from '@nestjs/common';
import { CleaningWorkerController } from './cleaning-worker.controller';
import { CleaningWorkerService } from './cleaning-worker.service';

@Module({
  imports: [],
  controllers: [CleaningWorkerController],
  providers: [CleaningWorkerService],
})
export class CleaningWorkerModule {}
