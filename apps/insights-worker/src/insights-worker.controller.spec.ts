import { Test, TestingModule } from '@nestjs/testing';
import { InsightsWorkerController } from './insights-worker.controller';
import { InsightsWorkerService } from './insights-worker.service';

describe('InsightsWorkerController', () => {
  let insightsWorkerController: InsightsWorkerController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [InsightsWorkerController],
      providers: [InsightsWorkerService],
    }).compile();

    insightsWorkerController = app.get<InsightsWorkerController>(InsightsWorkerController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(insightsWorkerController.getHello()).toBe('Hello World!');
    });
  });
});
