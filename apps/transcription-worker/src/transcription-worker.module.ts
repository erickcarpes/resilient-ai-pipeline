import { Module } from '@nestjs/common';
import { TranscriptionWorkerController } from './transcription-worker.controller';
import { TranscriptionWorkerService } from './transcription-worker.service';

@Module({
  imports: [],
  controllers: [TranscriptionWorkerController],
  providers: [TranscriptionWorkerService],
})
export class TranscriptionWorkerModule {}
