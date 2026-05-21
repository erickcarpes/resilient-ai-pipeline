// =============================================================================
// TRANSCRIPTION MOCK SERVICE — Simulated chaos
// =============================================================================
// Mimics an external speech-to-text API with realistic failure modes.
// Probabilities are controlled via .env so you can tune chaos without redeploying.
//
// COOPERATIVE CANCELLATION:
// Accepts an AbortSignal from withTimeout. Every suspension point (sleep) is
// cancellable, and we check signal.aborted before logging chaos events so that
// "orphan" log lines never appear after a timeout fires.
// =============================================================================
import { Injectable } from '@nestjs/common';
import { sleep } from '@pipeline/shared';
import type { TranscriptionResult } from '@pipeline/shared';

@Injectable()
export class TranscriptionMockService {
  async transcribe(
    rawText: string,
    signal?: AbortSignal,
  ): Promise<TranscriptionResult> {
    const timeoutProb = parseFloat(
      process.env.MOCK_TRANSCRIPTION_TIMEOUT_PROB ?? '0.2',
    );
    const errorProb = parseFloat(
      process.env.MOCK_TRANSCRIPTION_ERROR_PROB ?? '0.15',
    );

    // Inject timeout chaos — sleep longer than withTimeout will allow.
    // The AbortSignal cancels the sleep cooperatively when the timeout fires,
    // so this function exits without reaching the lines below (no orphan logs).
    if (Math.random() < timeoutProb) {
      await sleep(15_000, signal); // aborts immediately when signal fires
    }

    // Guard: if the signal fired during sleep (shouldn't reach here, but safe)
    if (signal?.aborted) return undefined as never;

    // Inject error chaos — simulates API being down
    if (Math.random() < errorProb) {
      throw new Error('Mock Transcription API: 503 Service Unavailable');
    }

    // Happy path — simulate realistic processing time (500ms–1.5s)
    const durationMs = Math.floor(Math.random() * 1000 + 500);
    await sleep(durationMs, signal);

    if (signal?.aborted) return undefined as never;

    const preview = rawText.substring(0, 80).replace(/\n/g, ' ');
    return {
      transcript: `[TRANSCRIBED] ${preview}...`,
      durationMs,
      language: 'pt-BR',
      processedAt: new Date().toISOString(),
    };
  }
}
