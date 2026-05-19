import { metrics, trace } from '@opentelemetry/api';

const SERVICE_NAME = 'cleaning-worker';
const STAGE_NAME = 'cleaning';

const meter = metrics.getMeter(SERVICE_NAME);

const jobReceived = meter.createCounter('jobs_received_total', {
  description: 'Total number of cleaning jobs received',
});
const jobSucceeded = meter.createCounter('jobs_succeeded_total', {
  description: 'Total number of cleaning jobs completed successfully',
});
const jobFailed = meter.createCounter('jobs_failed_total', {
  description: 'Total number of cleaning jobs that failed',
});
const jobRetries = meter.createCounter('jobs_retries_total', {
  description: 'Total number of cleaning job retries',
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
const nextStageEnqueued = meter.createCounter('next_stage_enqueued_total', {
  description: 'Total number of jobs forwarded to the next stage',
});

const jobDuration = meter.createHistogram('job_duration_seconds', {
  description: 'Duration of cleaning job processing in seconds',
  unit: 's',
});
const queueLatency = meter.createHistogram('queue_latency_seconds', {
  description: 'Time spent waiting in queue before processing',
  unit: 's',
});

const tracer = trace.getTracer(SERVICE_NAME);

export const cleaningMetrics = {
  jobReceived,
  jobSucceeded,
  jobFailed,
  jobRetries,
  circuitBreakerBlocked,
  idempotencyCacheHit,
  nextStageEnqueued,
  jobDuration,
  queueLatency,
};

export const cleaningTelemetry = {
  tracer,
  getMetricLabels: () => ({ service: SERVICE_NAME, stage: STAGE_NAME }),
  serviceName: SERVICE_NAME,
  stageName: STAGE_NAME,
};
