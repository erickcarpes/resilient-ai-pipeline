import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import {
  FAN_IN_KEYS,
  FAN_IN_TTL_SECONDS,
  MeetingStateService,
  REDIS_CLIENT,
  type DeadlinesResult,
} from '@pipeline/shared';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly meetingState: MeetingStateService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

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
      await this.meetingState.setCompleted(meetingId, hasPartial);
    }
  }
}
