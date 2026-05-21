import { Injectable } from '@nestjs/common';
import {
  type CircuitBreakerConfig,
  type JobPayload,
  type SummaryResult,
  AppLogger,
} from '@pipeline/shared';
import { SummaryMockService } from '../summary/mock/summary.mock';
import { ResilienceService } from './resilience.service';

const SERVICE = 'mock-summary-api';
const TIMEOUT_MS = parseInt(
  process.env.INSIGHTS_SUMMARY_TIMEOUT_MS ?? '8000',
  10,
);
const CB_CONFIG: CircuitBreakerConfig = {
  failureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD ?? '3', 10),
  cooldownMs: parseInt(process.env.CB_COOLDOWN_MS ?? '30000', 10),
};

@Injectable()
export class SummaryService {
  private readonly logger: AppLogger;

  constructor(
    private readonly mock: SummaryMockService,
    private readonly resilience: ResilienceService,
    baseLogger: AppLogger,
  ) {
    this.logger = baseLogger.child({ component: 'summary.service' });
  }

  async extract(payload: JobPayload): Promise<SummaryResult> {
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
          timeoutLabel: 'Summary',
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
