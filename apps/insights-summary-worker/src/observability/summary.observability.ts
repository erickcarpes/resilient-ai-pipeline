import { Span, SpanStatusCode } from '@opentelemetry/api';
import { Job } from 'bullmq';
import {
  CircuitOpenError,
  QUEUE_NAMES,
  type JobPayload,
} from '@pipeline/shared';
import { summaryMetrics, summaryTelemetry } from './summary.metrics';

export interface ObservabilityContext {
  labels: Record<string, string>;
  startTimeMs: number;
  span: Span;
}

export const startJobObservability = (
  job: Job<JobPayload>,
  meetingId: string,
): ObservabilityContext => {
  const labels = summaryTelemetry.getMetricLabels();
  const startTimeMs = Date.now();

  summaryMetrics.jobReceived.add(1, labels);
  if (job.attemptsMade > 0) {
    summaryMetrics.jobRetries.add(1, labels);
  }
  if (typeof job.timestamp === 'number' && job.timestamp > 0) {
    const latencySeconds = (Date.now() - job.timestamp) / 1000;
    summaryMetrics.queueLatency.record(latencySeconds, labels);
  }

  const span = summaryTelemetry.tracer.startSpan('summary.process', {
    attributes: {
      'service.name': summaryTelemetry.serviceName,
      'pipeline.stage': summaryTelemetry.stageName,
      'meeting.id': meetingId,
      'job.id': job.id ?? 'unknown',
      'job.attempt': job.attemptsMade + 1,
      'queue.name': QUEUE_NAMES.INSIGHTS_SUMMARY,
    },
  });

  return { labels, startTimeMs, span };
};

export const recordIdempotencyHit = (ctx: ObservabilityContext): void => {
  summaryMetrics.idempotencyCacheHit.add(1, ctx.labels);
  ctx.span.addEvent('idempotency.cache_hit');
};

export const recordFailure = (
  ctx: ObservabilityContext,
  error: Error,
): void => {
  summaryMetrics.jobFailed.add(1, ctx.labels);
  if (error instanceof CircuitOpenError) {
    summaryMetrics.circuitBreakerBlocked.add(1, ctx.labels);
    ctx.span.addEvent('circuit_breaker.blocked');
  }
  ctx.span.recordException(error);
  ctx.span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
};

export const recordSuccess = (ctx: ObservabilityContext): void => {
  summaryMetrics.jobSucceeded.add(1, ctx.labels);
};

export const finalizeObservability = (ctx: ObservabilityContext): void => {
  const durationSeconds = (Date.now() - ctx.startTimeMs) / 1000;
  summaryMetrics.jobDuration.record(durationSeconds, ctx.labels);
  ctx.span.end();
};
