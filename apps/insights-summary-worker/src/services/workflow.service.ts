import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import {
  FAN_IN_KEYS,
  FAN_IN_TTL_SECONDS,
  MeetingStateService,
  REDIS_CLIENT,
  type SummaryResult,
} from '@pipeline/shared';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly meetingState: MeetingStateService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

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

    const isDeadlinesDone = await this.redis.exists(
      FAN_IN_KEYS.deadlinesDone(meetingId),
    );

    if (isDeadlinesDone) {
      const hasPartial = summaryResult.fallback;
      await this.meetingState.setCompleted(meetingId, hasPartial);
    }
  }
}
