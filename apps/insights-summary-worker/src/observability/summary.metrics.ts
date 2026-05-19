import { metrics, trace } from '@opentelemetry/api';

const SERVICE_NAME = 'insights-summary-worker';
const STAGE_NAME = 'summary';

const meter = metrics.getMeter(SERVICE_NAME);

const jobReceived = meter.createCounter('jobs_received_total', {
  description: 'Total number of summary jobs received',
});
const jobSucceeded = meter.createCounter('jobs_succeeded_total', {
  description: 'Total number of summary jobs completed successfully',
});
const jobFailed = meter.createCounter('jobs_failed_total', {
  description: 'Total number of summary jobs that failed',
});
const jobRetries = meter.createCounter('jobs_retries_total', {
  description: 'Total number of summary job retries',
});
const circuitBreakerBlocked = meter.createCounter(
  'circuit_breaker_blocked_total',
  {
    description: 'Total number of jobs blocked by circuit breaker',
  },
);
const idempotencyCacheHit = meter.createCounter('idempotency_cache_hit_total', {
  description: 'Total number of idempotency cache hits',
});

const jobDuration = meter.createHistogram('job_duration_seconds', {
  description: 'Duration of summary job processing in seconds',
  unit: 's',
});
const queueLatency = meter.createHistogram('queue_latency_seconds', {
  description: 'Time spent waiting in queue before processing',
  unit: 's',
});

const tracer = trace.getTracer(SERVICE_NAME);

export const summaryMetrics = {
  jobReceived,
  jobSucceeded,
  jobFailed,
  jobRetries,
  circuitBreakerBlocked,
  idempotencyCacheHit,
  jobDuration,
  queueLatency,
};

export const summaryTelemetry = {
  tracer,
  getMetricLabels: () => ({ service: SERVICE_NAME, stage: STAGE_NAME }),
  serviceName: SERVICE_NAME,
  stageName: STAGE_NAME,
};
