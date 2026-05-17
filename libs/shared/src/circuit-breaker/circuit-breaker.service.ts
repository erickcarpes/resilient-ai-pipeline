// =============================================================================
// CIRCUIT BREAKER SERVICE
// =============================================================================
// Implements the Circuit Breaker pattern using Redis as shared state store.
//
// WHY REDIS for state? Because in production you run MULTIPLE INSTANCES of
// each worker. If each instance kept its own in-memory state, instance A might
// have a CLOSED circuit while instance B has OPEN — inconsistent behavior.
// Redis gives us ONE source of truth shared by all instances.
//
// STATE MACHINE:
//
//   ┌──────────────────────────────────────────────────────────────────┐
//   │                                                                  │
//   │   CLOSED ──(failureThreshold failures)──▶ OPEN                  │
//   │     ▲                                       │                   │
//   │     │                              (cooldownMs elapsed)         │
//   │     │                                       ▼                   │
//   │     └────────(1 success)────────── HALF_OPEN                    │
//   │                                    │ (1 failure)                │
//   │                                    └──────────────▶ OPEN        │
//   │                                                                  │
//   └──────────────────────────────────────────────────────────────────┘
//
// REDIS KEYS (per service):
//   cb:{service}:state     → 'CLOSED' | 'OPEN' | 'HALF_OPEN'
//   cb:{service}:failures  → number (consecutive failure count)
//   cb:{service}:opened_at → Unix timestamp (ms) when circuit opened
// =============================================================================

import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export enum CircuitState {
  CLOSED = 'CLOSED',       // Normal operation
  OPEN = 'OPEN',           // Failing fast — not calling downstream
  HALF_OPEN = 'HALF_OPEN', // Probe state — allowing one call to test recovery
}

export class CircuitOpenError extends Error {
  constructor(service: string, cooldownRemainingMs: number) {
    super(
      `Circuit breaker for "${service}" is OPEN. ` +
      `Failing fast. Cooldown remaining: ~${Math.ceil(cooldownRemainingMs / 1000)}s`,
    );
    this.name = 'CircuitOpenError';
  }
}

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit. */
  failureThreshold: number;
  /** How long (ms) the circuit stays OPEN before transitioning to HALF_OPEN. */
  cooldownMs: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // ── Key helpers (keeps key naming consistent) ─────────────────────────────

  private stateKey(service: string): string {
    return `cb:${service}:state`;
  }

  private failuresKey(service: string): string {
    return `cb:${service}:failures`;
  }

  private openedAtKey(service: string): string {
    return `cb:${service}:opened_at`;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Returns the current circuit state for a service.
   * Defaults to CLOSED if no state exists yet (first run).
   */
  async getState(service: string): Promise<CircuitState> {
    const state = await this.redis.get(this.stateKey(service));
    return (state as CircuitState) ?? CircuitState.CLOSED;
  }

  /**
   * Checks if a call to `service` is currently allowed.
   *
   * - CLOSED    → always allowed
   * - HALF_OPEN → allowed (it's a probe call)
   * - OPEN      → denied UNLESS cooldown has expired → then HALF_OPEN
   *
   * Throws `CircuitOpenError` if the call should be blocked.
   */
  async isAllowed(service: string, config: CircuitBreakerConfig): Promise<void> {
    const state = await this.getState(service);

    if (state === CircuitState.CLOSED || state === CircuitState.HALF_OPEN) {
      return; // Allowed — proceed normally
    }

    // State is OPEN: check if cooldown has expired
    const openedAt = await this.redis.get(this.openedAtKey(service));
    const elapsed = Date.now() - Number(openedAt);
    const remaining = config.cooldownMs - elapsed;

    if (elapsed >= config.cooldownMs) {
      // Cooldown expired → transition to HALF_OPEN and allow this probe call
      await this.redis.set(this.stateKey(service), CircuitState.HALF_OPEN);
      this.logger.warn(`[${service}] Circuit: OPEN → HALF_OPEN (probing recovery)`);
      return;
    }

    // Still within cooldown → fail fast
    throw new CircuitOpenError(service, remaining);
  }

  /**
   * Records a SUCCESSFUL call. Resets the circuit to CLOSED.
   *
   * Call this AFTER a downstream call succeeds.
   */
  async recordSuccess(service: string): Promise<void> {
    const previousState = await this.getState(service);

    await Promise.all([
      this.redis.set(this.stateKey(service), CircuitState.CLOSED),
      this.redis.del(this.failuresKey(service)),
      this.redis.del(this.openedAtKey(service)),
    ]);

    if (previousState !== CircuitState.CLOSED) {
      this.logger.log(`[${service}] Circuit: ${previousState} → CLOSED ✅`);
    }
  }

  /**
   * Records a FAILED call. May open the circuit.
   *
   * Call this AFTER a downstream call fails (in your catch block).
   *
   * Behavior:
   * - If HALF_OPEN: probe failed → go back to OPEN immediately
   * - If CLOSED:    increment counter → open if threshold reached
   * - If OPEN:      no-op (already open)
   */
  async recordFailure(service: string, config: CircuitBreakerConfig): Promise<void> {
    const state = await this.getState(service);

    if (state === CircuitState.HALF_OPEN) {
      // The probe call failed — recovery attempt unsuccessful
      await this.redis.set(this.stateKey(service), CircuitState.OPEN);
      await this.redis.set(this.openedAtKey(service), String(Date.now()));
      this.logger.error(`[${service}] Circuit: HALF_OPEN → OPEN 🔴 (probe failed)`);
      return;
    }

    if (state === CircuitState.OPEN) {
      // Already open — nothing to update (isAllowed already blocks calls)
      return;
    }

    // State is CLOSED: increment failure counter
    const failures = await this.redis.incr(this.failuresKey(service));

    this.logger.warn(
      `[${service}] Circuit: failure ${failures}/${config.failureThreshold}`,
    );

    if (failures >= config.failureThreshold) {
      await this.redis.set(this.stateKey(service), CircuitState.OPEN);
      await this.redis.set(this.openedAtKey(service), String(Date.now()));
      this.logger.error(
        `[${service}] Circuit: CLOSED → OPEN 🔴 (${failures} consecutive failures)`,
      );
    }
  }

  /**
   * Resets the circuit breaker for a service (useful for testing/admin).
   */
  async reset(service: string): Promise<void> {
    await Promise.all([
      this.redis.del(this.stateKey(service)),
      this.redis.del(this.failuresKey(service)),
      this.redis.del(this.openedAtKey(service)),
    ]);
    this.logger.log(`[${service}] Circuit: manually reset to CLOSED`);
  }
}
