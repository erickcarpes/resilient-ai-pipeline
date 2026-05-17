// @pipeline/shared — Public API
export { SharedModule } from './shared.module';

// ── Redis ─────────────────────────────────────────────────────────────────────
export { RedisModule } from './redis/redis.module';
export { REDIS_CLIENT } from './redis/redis.constants';

// ── Models ────────────────────────────────────────────────────────────────────
export {
  JobState,
  QUEUE_NAMES,
  type QueueName,
  type JobPayload,
  type JobStatus,
  type TranscriptionResult,
  type CleaningResult,
  type SummaryResult,
  type DeadlinesResult,
} from './models/job.models';

export { FAN_IN_KEYS, FAN_IN_TTL_SECONDS } from './models/fan-in.constants';

// ── Retry Utilities ───────────────────────────────────────────────────────────
export {
  sleep,
  calculateBackoff,
  addJitter,
  withTimeout,
  withRetry,
  TimeoutError,
  MaxRetriesExceededError,
  type RetryOptions,
} from './retry/retry.util';

// ── Circuit Breaker ───────────────────────────────────────────────────────────
export {
  CircuitBreakerService,
  CircuitOpenError,
  CircuitState,
  type CircuitBreakerConfig,
} from './circuit-breaker/circuit-breaker.service';

// ── Idempotency ───────────────────────────────────────────────────────────────
export { IdempotencyService } from './idempotency/idempotency.service';
