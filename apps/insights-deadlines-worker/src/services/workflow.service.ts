import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import {
  FAN_IN_KEYS,
  FAN_IN_TTL_SECONDS,
  MeetingStateService,
  REDIS_CLIENT,
  type DeadlinesResult,
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
    this.logger = baseLogger.child({ component: 'deadlines.workflow' });
  }

  async persistDeadlinesResult(
    meetingId: string,
    result: DeadlinesResult,
  ): Promise<void> {
    await this.meetingState.addPipelineResult(meetingId, 'deadlines', result);
  }

  async fanIn(
    meetingId: string,
    deadlinesResult: DeadlinesResult,
  ): Promise<void> {
    await this.redis.setex(
      FAN_IN_KEYS.deadlinesResult(meetingId),
      FAN_IN_TTL_SECONDS,
      JSON.stringify(deadlinesResult),
    );
    await this.redis.setex(
      FAN_IN_KEYS.deadlinesDone(meetingId),
      FAN_IN_TTL_SECONDS,
      '1',
    );

    this.logger.info({ event: 'FAN_IN_DEADLINES_DONE', meetingId });

    const isSummaryDone = await this.redis.exists(
      FAN_IN_KEYS.summaryDone(meetingId),
    );

    if (isSummaryDone) {
      const summaryRaw = await this.redis.get(
        FAN_IN_KEYS.summaryResult(meetingId),
      );
      const summaryFallback = summaryRaw
        ? (JSON.parse(summaryRaw) as { fallback: boolean }).fallback
        : false;
      const hasPartial = deadlinesResult.fallback || summaryFallback;
      this.logger.info({
        event: 'PIPELINE_STATE_COMPLETED',
        meetingId,
        finisher: 'deadlines',
        hasPartial,
      });
      await this.meetingState.setCompleted(meetingId, hasPartial);
    }
  }
}
