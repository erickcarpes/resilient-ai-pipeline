import { Injectable } from '@nestjs/common';
import {
  type CircuitBreakerConfig,
  type JobPayload,
  type CleaningResult,
  AppLogger,
} from '@pipeline/shared';
import { CleaningMockService } from '../cleaning/mock/cleaning.mock';
import { ResilienceService } from './resilience.service';

const SERVICE = 'mock-cleaning-api';
const TIMEOUT_MS = parseInt(process.env.CLEANING_TIMEOUT_MS ?? '2000', 10);
const CB_CONFIG: CircuitBreakerConfig = {
  failureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD ?? '3', 10),
  cooldownMs: parseInt(process.env.CB_COOLDOWN_MS ?? '30000', 10),
};

@Injectable()
export class CleaningService {
  private readonly logger: AppLogger;

  constructor(
    private readonly mock: CleaningMockService,
    private readonly resilience: ResilienceService,
    baseLogger: AppLogger,
  ) {
    this.logger = baseLogger.child({ component: 'cleaning.service' });
  }

  async clean(payload: JobPayload): Promise<CleaningResult> {
    const transcript = payload.transcription!.transcript;
    this.logger.info({
      event: 'API_CALL_START',
      service: SERVICE,
      meetingId: payload.meetingId,
    });
    const result = await this.resilience.execute(
      SERVICE,
      (signal) => this.mock.clean(transcript, signal),
      {
        timeoutMs: TIMEOUT_MS,
        timeoutLabel: 'Cleaning',
        circuitBreakerConfig: CB_CONFIG,
      },
    );
    this.logger.info({
      event: 'API_CALL_SUCCESS',
      service: SERVICE,
      meetingId: payload.meetingId,
    });
    return result;
  }
}
