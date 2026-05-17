import { Controller, Get } from '@nestjs/common';
import { CleaningWorkerService } from './cleaning-worker.service';

@Controller()
export class CleaningWorkerController {
  constructor(private readonly cleaningWorkerService: CleaningWorkerService) {}

  @Get()
  getHello(): string {
    return this.cleaningWorkerService.getHello();
  }
}
