import { Injectable } from '@nestjs/common';
import { sleep } from '@pipeline/shared';
import type { SummaryResult } from '@pipeline/shared';

@Injectable()
export class SummaryMockService {
  async extract(
    cleanedTranscript: string,
    signal?: AbortSignal,
  ): Promise<SummaryResult> {
    const errorProb = parseFloat(
      process.env.MOCK_INSIGHTS_ERROR_PROB ?? '0.25',
    );

    if (signal?.aborted) return undefined as never;

    if (Math.random() < errorProb) {
      throw new Error('Mock Summary AI: rate limit exceeded');
    }

    await sleep(Math.floor(Math.random() * 1500 + 800), signal);

    if (signal?.aborted) return undefined as never;

    const preview = cleanedTranscript.substring(0, 60);
    return {
      summary: `Executive summary of meeting discussing: ${preview}...`,
      actionPoints: [
        'Follow up with stakeholders by end of week',
        'Review project timeline and adjust milestones',
      ],
      attentionPoints: [
        'Budget constraints mentioned',
        'Timeline pressure noted',
      ],
      participants: ['Alice', 'Bob', 'Carol'],
      fallback: false,
      processedAt: new Date().toISOString(),
    };
  }

  /** Degraded fallback when all retries are exhausted */
  degraded(reason: string): SummaryResult {
    return {
      summary: null,
      actionPoints: [],
      attentionPoints: [],
      participants: [],
      fallback: true,
      fallbackReason: reason,
      processedAt: new Date().toISOString(),
    };
  }
}
