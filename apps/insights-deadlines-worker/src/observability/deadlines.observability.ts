import { Span, SpanStatusCode } from '@opentelemetry/api';
import { Job } from 'bullmq';
import {
  CircuitOpenError,
  QUEUE_NAMES,
  type JobPayload,
} from '@pipeline/shared';
import { deadlinesMetrics, deadlinesTelemetry } from './deadlines.metrics';

export interface ObservabilityContext {
  labels: Record<string, string>;
  startTimeMs: number;
  span: Span;
}

export const startJobObservability = (
  job: Job<JobPayload>,
  meetingId: string,
): ObservabilityContext => {
  const labels = deadlinesTelemetry.getMetricLabels();
  const startTimeMs = Date.now();

  deadlinesMetrics.jobReceived.add(1, labels);
  if (job.attemptsMade > 0) {
    deadlinesMetrics.jobRetries.add(1, labels);
  }
  if (typeof job.timestamp === 'number' && job.timestamp > 0) {
    const latencySeconds = (Date.now() - job.timestamp) / 1000;
    deadlinesMetrics.queueLatency.record(latencySeconds, labels);
  }

  const span = deadlinesTelemetry.tracer.startSpan('deadlines.process', {
    attributes: {
      'service.name': deadlinesTelemetry.serviceName,
      'pipeline.stage': deadlinesTelemetry.stageName,
      'meeting.id': meetingId,
      'job.id': job.id ?? 'unknown',
      'job.attempt': job.attemptsMade + 1,
      'queue.name': QUEUE_NAMES.INSIGHTS_DEADLINES,
    },
  });

  return { labels, startTimeMs, span };
};

export const recordIdempotencyHit = (ctx: ObservabilityContext): void => {
  deadlinesMetrics.idempotencyCacheHit.add(1, ctx.labels);
  ctx.span.addEvent('idempotency.cache_hit');
};

export const recordFailure = (
  ctx: ObservabilityContext,
  error: Error,
): void => {
  deadlinesMetrics.jobFailed.add(1, ctx.labels);
  if (error instanceof CircuitOpenError) {
    deadlinesMetrics.circuitBreakerBlocked.add(1, ctx.labels);
    ctx.span.addEvent('circuit_breaker.blocked');
  }
  ctx.span.recordException(error);
  ctx.span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
};

export const recordSuccess = (ctx: ObservabilityContext): void => {
  deadlinesMetrics.jobSucceeded.add(1, ctx.labels);
};

export const finalizeObservability = (ctx: ObservabilityContext): void => {
  const durationSeconds = (Date.now() - ctx.startTimeMs) / 1000;
  deadlinesMetrics.jobDuration.record(durationSeconds, ctx.labels);
  ctx.span.end();
};
