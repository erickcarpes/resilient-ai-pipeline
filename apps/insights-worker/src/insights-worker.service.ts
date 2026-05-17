import { Injectable } from '@nestjs/common';

@Injectable()
export class InsightsWorkerService {
  getHello(): string {
    return 'Hello World!';
  }
}
