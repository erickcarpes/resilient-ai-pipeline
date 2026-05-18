// =============================================================================
// TRANSCRIPTION MOCK SERVICE — Simulated chaos
// =============================================================================
// Mimics an external speech-to-text API with realistic failure modes.
// Probabilities are controlled via .env so you can tune chaos without redeploying.
// =============================================================================
import { Injectable, Logger } from '@nestjs/common';
import { sleep } from '@pipeline/shared';
import type { TranscriptionResult } from '@pipeline/shared';

@Injectable()
export class TranscriptionMockService {
  private readonly logger = new Logger(TranscriptionMockService.name);

  async transcribe(rawText: string): Promise<TranscriptionResult> {
    const timeoutProb = parseFloat(
      process.env.MOCK_TRANSCRIPTION_TIMEOUT_PROB ?? '0.2',
    );
    const errorProb = parseFloat(
      process.env.MOCK_TRANSCRIPTION_ERROR_PROB ?? '0.15',
    );

    // Inject timeout chaos — sleep longer than withTimeout will allow
    if (Math.random() < timeoutProb) {
      this.logger.warn('[CHAOS] Injecting artificial timeout...');
      await sleep(15_000); // withTimeout(5000) will kill this first
    }

    // Inject error chaos — simulates API being down
    if (Math.random() < errorProb) {
      this.logger.warn('[CHAOS] Injecting API error...');
      throw new Error('Mock Transcription API: 503 Service Unavailable');
    }

    // Happy path — simulate realistic processing time (500ms–1.5s)
    const durationMs = Math.floor(Math.random() * 1000 + 500);
    await sleep(durationMs);

    const preview = rawText.substring(0, 80).replace(/\n/g, ' ');
    return {
      transcript: `[TRANSCRIBED] ${preview}...`,
      durationMs,
      language: 'pt-BR',
      processedAt: new Date().toISOString(),
    };
  }
}
