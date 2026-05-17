import { Test, TestingModule } from '@nestjs/testing';
import { TranscriptionWorkerController } from './transcription-worker.controller';
import { TranscriptionWorkerService } from './transcription-worker.service';

describe('TranscriptionWorkerController', () => {
  let transcriptionWorkerController: TranscriptionWorkerController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [TranscriptionWorkerController],
      providers: [TranscriptionWorkerService],
    }).compile();

    transcriptionWorkerController = app.get<TranscriptionWorkerController>(TranscriptionWorkerController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(transcriptionWorkerController.getHello()).toBe('Hello World!');
    });
  });
});
