import { Injectable } from '@nestjs/common';

@Injectable()
export class TranscriptionWorkerService {
  getHello(): string {
    return 'Hello World!';
  }
}
