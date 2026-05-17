import { Injectable } from '@nestjs/common';

@Injectable()
export class CleaningWorkerService {
  getHello(): string {
    return 'Hello World!';
  }
}
