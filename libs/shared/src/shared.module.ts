import { Module } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker/circuit-breaker.service';
import { IdempotencyService } from './idempotency/idempotency.service';
import { MeetingStateService } from './meeting-state/meeting-state.service';

@Module({
  providers: [CircuitBreakerService, IdempotencyService, MeetingStateService],
  exports: [CircuitBreakerService, IdempotencyService, MeetingStateService],
})
export class SharedModule {}
