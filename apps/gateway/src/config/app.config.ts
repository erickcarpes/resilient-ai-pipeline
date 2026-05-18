// =============================================================================
// APP CONFIG — Typed configuration factory
// =============================================================================
// NestJS ConfigModule loads this function and makes its return value
// available via ConfigService.get('key.nested').
//
// WHY A FACTORY FUNCTION instead of just reading process.env directly?
// 1. Centralized: all config in one place, not scattered across files
// 2. Typed: TypeScript knows the shape of our config
// 3. Defaulted: sensible defaults for local dev without needing a full .env
// 4. Validated: we can add validation here (e.g., with Joi schemas) later
// =============================================================================

export const appConfig = () => ({
  // HTTP port for the Gateway API
  port: parseInt(process.env.GATEWAY_PORT ?? '3001', 10),

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },

  // Queue names — must match the constants in @pipeline/shared.
  // Kept here so each app can override them via env if needed.
  queues: {
    transcription: process.env.TRANSCRIPTION_QUEUE ?? 'transcription',
    cleaning: process.env.CLEANING_QUEUE ?? 'cleaning',
    insightsSummary: process.env.INSIGHTS_SUMMARY_QUEUE ?? 'insights-summary',
    insightsDeadlines:
      process.env.INSIGHTS_DEADLINES_QUEUE ?? 'insights-deadlines',
  },

  // Resilience config — injected into CircuitBreakerService and withRetry calls
  // These match the .env variables so the entire system is tunable at deploy time
  resilience: {
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS ?? '5', 10),
    retryBaseDelayMs: parseInt(process.env.RETRY_BASE_DELAY_MS ?? '1000', 10),
    cbFailureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD ?? '3', 10),
    cbCooldownMs: parseInt(process.env.CB_COOLDOWN_MS ?? '30000', 10),
  },
});

// TypeScript type derived from the factory — use this to type injected config
export type AppConfig = ReturnType<typeof appConfig>;
