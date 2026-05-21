import { Module } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker/circuit-breaker.service';
import { IdempotencyService } from './idempotency/idempotency.service';
import { MeetingStateService } from './meeting-state/meeting-state.service';

import { LoggerModule } from './logging/logger.module';

@Module({
  imports: [LoggerModule],
  providers: [CircuitBreakerService, IdempotencyService, MeetingStateService],
  exports: [
    LoggerModule,
    CircuitBreakerService,
    IdempotencyService,
    MeetingStateService,
  ],
})
export class SharedModule {}
