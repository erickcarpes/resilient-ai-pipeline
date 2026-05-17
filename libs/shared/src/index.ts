// =============================================================================
// @pipeline/shared — Public API
// =============================================================================
// Everything exported from here is accessible to all apps in the monorepo via:
//   import { ... } from '@pipeline/shared';
//
// Internal implementation details (e.g., redis.constants.ts) are exported
// so apps can use the REDIS_CLIENT token for their own providers if needed.
// =============================================================================

// ── Module ────────────────────────────────────────────────────────────────────
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
  type InsightsResult,
} from './models/job.models';

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
