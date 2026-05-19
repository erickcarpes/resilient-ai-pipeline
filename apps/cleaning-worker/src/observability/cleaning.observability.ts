import { Span, SpanStatusCode } from '@opentelemetry/api';
import { Job } from 'bullmq';
import {
  CircuitOpenError,
  QUEUE_NAMES,
  type JobPayload,
} from '@pipeline/shared';
import { cleaningMetrics, cleaningTelemetry } from './cleaning.metrics';

export interface ObservabilityContext {
  labels: Record<string, string>;
  startTimeMs: number;
  span: Span;
}

export const startJobObservability = (
  job: Job<JobPayload>,
  meetingId: string,
): ObservabilityContext => {
  const labels = cleaningTelemetry.getMetricLabels();
  const startTimeMs = Date.now();

  cleaningMetrics.jobReceived.add(1, labels);
  if (job.attemptsMade > 0) {
    cleaningMetrics.jobRetries.add(1, labels);
  }
  if (typeof job.timestamp === 'number' && job.timestamp > 0) {
    const latencySeconds = (Date.now() - job.timestamp) / 1000;
    cleaningMetrics.queueLatency.record(latencySeconds, labels);
  }

  const span = cleaningTelemetry.tracer.startSpan('cleaning.process', {
    attributes: {
      'service.name': cleaningTelemetry.serviceName,
      'pipeline.stage': cleaningTelemetry.stageName,
      'meeting.id': meetingId,
      'job.id': job.id ?? 'unknown',
      'job.attempt': job.attemptsMade + 1,
      'queue.name': QUEUE_NAMES.CLEANING,
    },
  });

  return { labels, startTimeMs, span };
};

export const recordIdempotencyHit = (ctx: ObservabilityContext): void => {
  cleaningMetrics.idempotencyCacheHit.add(1, ctx.labels);
  ctx.span.addEvent('idempotency.cache_hit');
};

export const recordNextStageEnqueued = (
  ctx: ObservabilityContext,
  count = 1,
): void => {
  cleaningMetrics.nextStageEnqueued.add(count, ctx.labels);
};

export const recordFailure = (
  ctx: ObservabilityContext,
  error: Error,
): void => {
  cleaningMetrics.jobFailed.add(1, ctx.labels);
  if (error instanceof CircuitOpenError) {
    cleaningMetrics.circuitBreakerBlocked.add(1, ctx.labels);
    ctx.span.addEvent('circuit_breaker.blocked');
  }
  ctx.span.recordException(error);
  ctx.span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
};

export const recordSuccess = (ctx: ObservabilityContext): void => {
  cleaningMetrics.jobSucceeded.add(1, ctx.labels);
};

export const finalizeObservability = (ctx: ObservabilityContext): void => {
  const durationSeconds = (Date.now() - ctx.startTimeMs) / 1000;
  cleaningMetrics.jobDuration.record(durationSeconds, ctx.labels);
  ctx.span.end();
};
