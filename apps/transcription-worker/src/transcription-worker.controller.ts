import { Controller, Get } from '@nestjs/common';
import { TranscriptionWorkerService } from './transcription-worker.service';

@Controller()
export class TranscriptionWorkerController {
  constructor(private readonly transcriptionWorkerService: TranscriptionWorkerService) {}

  @Get()
  getHello(): string {
    return this.transcriptionWorkerService.getHello();
  }
}
