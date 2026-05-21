import { Injectable } from '@nestjs/common';
import { sleep } from '@pipeline/shared';
import type { CleaningResult } from '@pipeline/shared';

@Injectable()
export class CleaningMockService {
  async clean(
    transcript: string,
    signal?: AbortSignal,
  ): Promise<CleaningResult> {
    const errorProb = parseFloat(process.env.MOCK_CLEANING_ERROR_PROB ?? '0.2');

    if (signal?.aborted) return undefined as never;

    if (Math.random() < errorProb) {
      throw new Error('Mock Cleaning API: NLP service unavailable');
    }

    await sleep(Math.floor(Math.random() * 500 + 200), signal);

    if (signal?.aborted) return undefined as never;

    const fillerWords = ['uh', 'um', 'like', 'you know', 'basically'];
    let cleaned = transcript;
    let removed = 0;
    for (const w of fillerWords) {
      const regex = new RegExp(`\\b${w}\\b`, 'gi');
      const matches = cleaned.match(regex)?.length ?? 0;
      cleaned = cleaned.replace(regex, '');
      removed += matches;
    }

    return {
      cleanedTranscript: cleaned.trim(),
      removedFillerWords: removed,
      speakerCount: Math.floor(Math.random() * 3 + 1),
      processedAt: new Date().toISOString(),
    };
  }
}
