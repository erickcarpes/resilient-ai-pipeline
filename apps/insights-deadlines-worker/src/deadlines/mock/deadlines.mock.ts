import { Injectable } from '@nestjs/common';
import { sleep } from '@pipeline/shared';
import type { DeadlinesResult } from '@pipeline/shared';

@Injectable()
export class DeadlinesMockService {
  async extract(
    cleanedTranscript: string,
    signal?: AbortSignal,
  ): Promise<DeadlinesResult> {
    const errorProb = parseFloat(
      process.env.MOCK_INSIGHTS_ERROR_PROB ?? '0.25',
    );

    if (signal?.aborted) return undefined as never;

    if (Math.random() < errorProb) {
      throw new Error('Mock Deadlines AI: context window exceeded');
    }

    await sleep(Math.floor(Math.random() * 1200 + 600), signal);

    if (signal?.aborted) return undefined as never;

    return {
      deadlines: [
        'Project delivery: 2025-06-30',
        'Report submission: 2025-05-31',
      ],
      keyDates: ['Stakeholder review: 2025-05-25'],
      followUpItems: ['Confirm budget allocation with finance team'],
      fallback: false,
      processedAt: new Date().toISOString(),
    };
  }

  degraded(reason: string): DeadlinesResult {
    return {
      deadlines: [],
      keyDates: [],
      followUpItems: [],
      fallback: true,
      fallbackReason: reason,
      processedAt: new Date().toISOString(),
    };
  }
}
