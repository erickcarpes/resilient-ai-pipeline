import { Test, TestingModule } from '@nestjs/testing';
import { CleaningWorkerController } from './cleaning-worker.controller';
import { CleaningWorkerService } from './cleaning-worker.service';

describe('CleaningWorkerController', () => {
  let cleaningWorkerController: CleaningWorkerController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [CleaningWorkerController],
      providers: [CleaningWorkerService],
    }).compile();

    cleaningWorkerController = app.get<CleaningWorkerController>(CleaningWorkerController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(cleaningWorkerController.getHello()).toBe('Hello World!');
    });
  });
});
