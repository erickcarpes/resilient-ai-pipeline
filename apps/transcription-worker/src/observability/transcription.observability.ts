import { Span, SpanStatusCode } from '@opentelemetry/api';
import { Job } from 'bullmq';
import {
  CircuitOpenError,
  QUEUE_NAMES,
  type JobPayload,
} from '@pipeline/shared';
import {
  transcriptionMetrics,
  transcriptionTelemetry,
} from './transcription.metrics';

export interface ObservabilityContext {
  labels: Record<string, string>;
  startTimeMs: number;
  span: Span;
}

export const startJobObservability = (
  job: Job<JobPayload>,
  meetingId: string,
): ObservabilityContext => {
  const labels = transcriptionTelemetry.getMetricLabels();
  const startTimeMs = Date.now();

  transcriptionMetrics.jobReceived.add(1, labels);
  if (job.attemptsMade > 0) {
    transcriptionMetrics.jobRetries.add(1, labels);
  }
  if (typeof job.timestamp === 'number' && job.timestamp > 0) {
    const latencySeconds = (Date.now() - job.timestamp) / 1000;
    transcriptionMetrics.queueLatency.record(latencySeconds, labels);
  }

  const span = transcriptionTelemetry.tracer.startSpan(
    'transcription.process',
    {
      attributes: {
        'service.name': transcriptionTelemetry.serviceName,
        'pipeline.stage': transcriptionTelemetry.stageName,
        'meeting.id': meetingId,
        'job.id': job.id ?? 'unknown',
        'job.attempt': job.attemptsMade + 1,
        'queue.name': QUEUE_NAMES.TRANSCRIPTION,
      },
    },
  );

  return { labels, startTimeMs, span };
};

export const recordIdempotencyHit = (ctx: ObservabilityContext): void => {
  transcriptionMetrics.idempotencyCacheHit.add(1, ctx.labels);
  ctx.span.addEvent('idempotency.cache_hit');
};

export const recordNextStageEnqueued = (ctx: ObservabilityContext): void => {
  transcriptionMetrics.nextStageEnqueued.add(1, ctx.labels);
};

export const recordFailure = (
  ctx: ObservabilityContext,
  error: Error,
): void => {
  transcriptionMetrics.jobFailed.add(1, ctx.labels);
  if (error instanceof CircuitOpenError) {
    transcriptionMetrics.circuitBreakerBlocked.add(1, ctx.labels);
    ctx.span.addEvent('circuit_breaker.blocked');
  }
  ctx.span.recordException(error);
  ctx.span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
};

export const recordSuccess = (ctx: ObservabilityContext): void => {
  transcriptionMetrics.jobSucceeded.add(1, ctx.labels);
};

export const finalizeObservability = (ctx: ObservabilityContext): void => {
  const durationSeconds = (Date.now() - ctx.startTimeMs) / 1000;
  transcriptionMetrics.jobDuration.record(durationSeconds, ctx.labels);
  ctx.span.end();
};
