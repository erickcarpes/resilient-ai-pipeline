// =============================================================================
// IDEMPOTENCY SERVICE
// =============================================================================
// Ensures that processing the same job multiple times produces the same result
// (and actually SKIPS re-processing if we already have the result cached).
//
// WHY DO WE NEED THIS?
// BullMQ guarantees at-least-once delivery. This means in edge cases
// (worker crash after processing but before ACK), a job can be delivered TWICE.
//
// Without idempotency:
//   Job arrives → worker calls mock API → worker crashes → BullMQ re-delivers
//   → worker calls mock API AGAIN → double billing, double processing
//
// With idempotency:
//   Job arrives → check Redis → no result cached → call API → store result
//   Job arrives AGAIN → check Redis → result found → return cached → skip API
//
// REDIS KEY FORMAT:
//   idempotency:{stage}:{idempotencyKey}
//   e.g.: idempotency:transcription:meetingAbc:1
//
// TTL: 24 hours by default. After that, the cache expires and the job
// would be re-processed if re-delivered (acceptable trade-off for storage).
// =============================================================================

import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Builds a namespaced Redis key for a specific stage + job.
   *
   * @param stage - The pipeline stage name (e.g., 'transcription')
   * @param idempotencyKey - Unique key from the job payload
   *
   * @example
   * buildKey('transcription', 'meetingAbc:1')
   * // → 'idempotency:transcription:meetingAbc:1'
   */
  buildKey(stage: string, idempotencyKey: string): string {
    return `idempotency:${stage}:${idempotencyKey}`;
  }

  /**
   * Checks if a result for this key already exists in Redis.
   *
   * Returns the cached result if found, or `null` if this is a new job.
   *
   * @example
   * const cached = await idempotency.get<TranscriptionResult>(
   *   'transcription',
   *   job.data.idempotencyKey
   * );
   * if (cached) return cached; // Skip re-processing
   */
  async get<T>(stage: string, idempotencyKey: string): Promise<T | null> {
    const key = this.buildKey(stage, idempotencyKey);
    const raw = await this.redis.get(key);

    if (!raw) return null;

    this.logger.debug(`[Idempotency] Cache HIT for key: ${key}`);
    return JSON.parse(raw) as T;
  }

  /**
   * Stores a result in Redis with a TTL.
   *
   * Call this AFTER successful processing so future duplicate deliveries
   * can skip re-processing.
   *
   * @param stage - The pipeline stage name
   * @param idempotencyKey - Unique key from the job payload
   * @param result - The result to cache
   * @param ttlSeconds - Cache duration. Default: 86400 (24 hours)
   *
   * @example
   * await idempotency.set('transcription', job.data.idempotencyKey, result);
   */
  async set<T>(
    stage: string,
    idempotencyKey: string,
    result: T,
    ttlSeconds = 86400,
  ): Promise<void> {
    const key = this.buildKey(stage, idempotencyKey);
    await this.redis.setex(key, ttlSeconds, JSON.stringify(result));
    this.logger.debug(`[Idempotency] Cached result for key: ${key} (TTL: ${ttlSeconds}s)`);
  }

  /**
   * Removes a cached result (useful for forced reprocessing or testing).
   */
  async invalidate(stage: string, idempotencyKey: string): Promise<void> {
    const key = this.buildKey(stage, idempotencyKey);
    await this.redis.del(key);
    this.logger.debug(`[Idempotency] Invalidated key: ${key}`);
  }
}
