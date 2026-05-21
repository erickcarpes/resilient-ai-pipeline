import { Injectable } from '@nestjs/common';
import {
  type CircuitBreakerConfig,
  type JobPayload,
  type TranscriptionResult,
  AppLogger,
} from '@pipeline/shared';
import { ResilienceService } from './resilience.service';
import { TranscriptionMockService } from '../transcription/mock/transcription.mock';

const SERVICE = 'mock-transcription-api';
const TIMEOUT_MS = parseInt(process.env.TRANSCRIPTION_TIMEOUT_MS ?? '5000', 10);
const CB_CONFIG: CircuitBreakerConfig = {
  failureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD ?? '3', 10),
  cooldownMs: parseInt(process.env.CB_COOLDOWN_MS ?? '30000', 10),
};

@Injectable()
export class TranscriptionService {
  private readonly logger: AppLogger;

  constructor(
    private readonly mock: TranscriptionMockService,
    private readonly resilience: ResilienceService,
    baseLogger: AppLogger,
  ) {
    this.logger = baseLogger.child({ component: 'transcription.service' });
  }

  async transcribe(payload: JobPayload): Promise<TranscriptionResult> {
    this.logger.info({
      event: 'API_CALL_START',
      service: SERVICE,
      meetingId: payload.meetingId,
    });
    const result = await this.resilience.execute(
      SERVICE,
      (signal) => this.mock.transcribe(payload.rawAudioText, signal),
      {
        timeoutMs: TIMEOUT_MS,
        timeoutLabel: 'Transcription',
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
