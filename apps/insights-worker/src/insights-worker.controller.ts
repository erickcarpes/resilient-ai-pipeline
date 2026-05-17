import { Controller, Get } from '@nestjs/common';
import { InsightsWorkerService } from './insights-worker.service';

@Controller()
export class InsightsWorkerController {
  constructor(private readonly insightsWorkerService: InsightsWorkerService) {}

  @Get()
  getHello(): string {
    return this.insightsWorkerService.getHello();
  }
}
