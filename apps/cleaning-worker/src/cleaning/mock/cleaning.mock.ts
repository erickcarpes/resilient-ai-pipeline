import { Injectable, Logger } from '@nestjs/common';
import { sleep } from '@pipeline/shared';
import type { CleaningResult } from '@pipeline/shared';

@Injectable()
export class CleaningMockService {
  private readonly logger = new Logger(CleaningMockService.name);

  async clean(transcript: string): Promise<CleaningResult> {
    const errorProb = parseFloat(process.env.MOCK_CLEANING_ERROR_PROB ?? '0.2');

    if (Math.random() < errorProb) {
      this.logger.warn('[CHAOS] Injecting cleaning error...');
      throw new Error('Mock Cleaning API: NLP service unavailable');
    }

    await sleep(Math.floor(Math.random() * 500 + 200));

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
