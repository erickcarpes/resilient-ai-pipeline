import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import {
  FAN_IN_KEYS,
  FAN_IN_TTL_SECONDS,
  MeetingStateService,
  REDIS_CLIENT,
  type SummaryResult,
  AppLogger,
} from '@pipeline/shared';

@Injectable()
export class WorkflowService {
  private readonly logger: AppLogger;

  constructor(
    private readonly meetingState: MeetingStateService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    baseLogger: AppLogger,
  ) {
    this.logger = baseLogger.child({ component: 'summary.workflow' });
  }

  async persistSummaryResult(
    meetingId: string,
    result: SummaryResult,
  ): Promise<void> {
    await this.meetingState.addPipelineResult(meetingId, 'summary', result);
  }

  async fanIn(meetingId: string, summaryResult: SummaryResult): Promise<void> {
    await this.redis.setex(
      FAN_IN_KEYS.summaryResult(meetingId),
      FAN_IN_TTL_SECONDS,
      JSON.stringify(summaryResult),
    );
    await this.redis.setex(
      FAN_IN_KEYS.summaryDone(meetingId),
      FAN_IN_TTL_SECONDS,
      '1',
    );

    this.logger.info({ event: 'FAN_IN_SUMMARY_DONE', meetingId });

    const isDeadlinesDone = await this.redis.exists(
      FAN_IN_KEYS.deadlinesDone(meetingId),
    );

    if (isDeadlinesDone) {
      const hasPartial = summaryResult.fallback;
      this.logger.info({
        event: 'PIPELINE_STATE_COMPLETED',
        meetingId,
        finisher: 'summary',
        hasPartial,
      });
      await this.meetingState.setCompleted(meetingId, hasPartial);
    }
  }
}
