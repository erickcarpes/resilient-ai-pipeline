"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appConfig = void 0;
const appConfig = () => ({
    port: parseInt(process.env.GATEWAY_PORT ?? '3001', 10),
    redis: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    },
    queues: {
        transcription: process.env.TRANSCRIPTION_QUEUE ?? 'transcription',
        cleaning: process.env.CLEANING_QUEUE ?? 'cleaning',
        insightsSummary: process.env.INSIGHTS_SUMMARY_QUEUE ?? 'insights-summary',
        insightsDeadlines: process.env.INSIGHTS_DEADLINES_QUEUE ?? 'insights-deadlines',
    },
    resilience: {
        retryAttempts: parseInt(process.env.RETRY_ATTEMPTS ?? '5', 10),
        retryBaseDelayMs: parseInt(process.env.RETRY_BASE_DELAY_MS ?? '1000', 10),
        cbFailureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD ?? '3', 10),
        cbCooldownMs: parseInt(process.env.CB_COOLDOWN_MS ?? '30000', 10),
    },
});
exports.appConfig = appConfig;
//# sourceMappingURL=app.config.js.map