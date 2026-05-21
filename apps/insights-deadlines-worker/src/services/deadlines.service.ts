import { Injectable } from '@nestjs/common';
import {
  type CircuitBreakerConfig,
  type JobPayload,
  type DeadlinesResult,
  AppLogger,
} from '@pipeline/shared';
import { DeadlinesMockService } from '../deadlines/mock/deadlines.mock';
import { ResilienceService } from './resilience.service';

const SERVICE = 'mock-deadlines-api';
const TIMEOUT_MS = parseInt(
  process.env.INSIGHTS_DEADLINES_TIMEOUT_MS ?? '6000',
  10,
);
const CB_CONFIG: CircuitBreakerConfig = {
  failureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD ?? '3', 10),
  cooldownMs: parseInt(process.env.CB_COOLDOWN_MS ?? '30000', 10),
};

@Injectable()
export class DeadlinesService {
  private readonly logger: AppLogger;

  constructor(
    private readonly mock: DeadlinesMockService,
    private readonly resilience: ResilienceService,
    baseLogger: AppLogger,
  ) {
    this.logger = baseLogger.child({ component: 'deadlines.service' });
  }

  async extract(payload: JobPayload): Promise<DeadlinesResult> {
    const transcript = payload.cleaning!.cleanedTranscript;

    this.logger.info({
      event: 'API_CALL_START',
      service: SERVICE,
      meetingId: payload.meetingId,
    });
    try {
      const result = await this.resilience.execute(
        SERVICE,
        (signal) => this.mock.extract(transcript, signal),
        {
          timeoutMs: TIMEOUT_MS,
          timeoutLabel: 'Deadlines',
          circuitBreakerConfig: CB_CONFIG,
        },
      );
      this.logger.info({
        event: 'API_CALL_SUCCESS',
        service: SERVICE,
        meetingId: payload.meetingId,
      });
      return result;
    } catch (err) {
      this.logger.warn({
        event: 'API_CALL_DEGRADED',
        service: SERVICE,
        meetingId: payload.meetingId,
        reason: (err as Error).message,
      });
      return this.mock.degraded((err as Error).message);
    }
  }
}
