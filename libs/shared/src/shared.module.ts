import { Module } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker/circuit-breaker.service';
import { IdempotencyService } from './idempotency/idempotency.service';

// The SharedModule provides the services that need NestJS DI (Redis-backed ones).
// Pure utilities (retry.util.ts) are just imported directly — no DI needed.
//
// Apps import SharedModule alongside RedisModule:
//   imports: [RedisModule.forRoot({ host: '...', port: 6379 }), SharedModule]
@Module({
  providers: [CircuitBreakerService, IdempotencyService],
  exports: [CircuitBreakerService, IdempotencyService],
})
export class SharedModule {}
