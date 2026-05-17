// =============================================================================
// CIRCUIT BREAKER — Unit Tests
// =============================================================================
// We test the CircuitBreakerService using ioredis-mock — an in-memory
// implementation of Redis. No real Redis needed, tests run instantly.
//
// IMPORTANT: ioredis-mock doesn't implement ALL Redis commands perfectly,
// but it covers GET, SET, DEL, INCR which is everything we use. Fine for unit tests.
//
// Key patterns shown here:
//   1. Instantiating a service with a mocked dependency (no NestJS DI overhead)
//   2. Testing state machine transitions explicitly
//   3. Using beforeEach to reset state between tests
// =============================================================================

import RedisMock from 'ioredis-mock';
import Redis from 'ioredis';
import {
  CircuitBreakerService,
  CircuitOpenError,
  CircuitState,
} from './circuit-breaker.service';

// ─── Test Setup ───────────────────────────────────────────────────────────────

const SERVICE = 'mock-transcription-api';

const CONFIG = {
  failureThreshold: 3,
  cooldownMs: 30_000,
};

let redis: Redis;
let circuitBreaker: CircuitBreakerService;

beforeEach(() => {
  // Fresh in-memory Redis for each test — no state leaks between tests
  redis = new RedisMock();
  circuitBreaker = new CircuitBreakerService(redis);
});

// ─── Initial State ────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('should default to CLOSED when no state exists', async () => {
    const state = await circuitBreaker.getState(SERVICE);
    expect(state).toBe(CircuitState.CLOSED);
  });

  it('should allow calls when state is CLOSED', async () => {
    await expect(
      circuitBreaker.isAllowed(SERVICE, CONFIG),
    ).resolves.not.toThrow();
  });
});

// ─── CLOSED → OPEN Transition ─────────────────────────────────────────────────

describe('CLOSED → OPEN transition', () => {
  it('should track failures and open circuit at threshold', async () => {
    // Two failures: still CLOSED
    await circuitBreaker.recordFailure(SERVICE, CONFIG);
    await circuitBreaker.recordFailure(SERVICE, CONFIG);
    expect(await circuitBreaker.getState(SERVICE)).toBe(CircuitState.CLOSED);

    // Third failure: trips the circuit
    await circuitBreaker.recordFailure(SERVICE, CONFIG);
    expect(await circuitBreaker.getState(SERVICE)).toBe(CircuitState.OPEN);
  });

  it('should block calls with CircuitOpenError when OPEN', async () => {
    // Open the circuit
    await circuitBreaker.recordFailure(SERVICE, CONFIG);
    await circuitBreaker.recordFailure(SERVICE, CONFIG);
    await circuitBreaker.recordFailure(SERVICE, CONFIG);

    await expect(circuitBreaker.isAllowed(SERVICE, CONFIG)).rejects.toThrow(
      CircuitOpenError,
    );
  });

  it('should reset failure count on success (no partial failures accumulate)', async () => {
    // Two failures, then a success — count should reset
    await circuitBreaker.recordFailure(SERVICE, CONFIG);
    await circuitBreaker.recordFailure(SERVICE, CONFIG);
    await circuitBreaker.recordSuccess(SERVICE);

    // Now 2 more failures — still shouldn't open (count was reset)
    await circuitBreaker.recordFailure(SERVICE, CONFIG);
    await circuitBreaker.recordFailure(SERVICE, CONFIG);

    expect(await circuitBreaker.getState(SERVICE)).toBe(CircuitState.CLOSED);
  });
});

// ─── OPEN → HALF_OPEN Transition (cooldown) ───────────────────────────────────

describe('OPEN → HALF_OPEN transition', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    // Open the circuit
    await circuitBreaker.recordFailure(SERVICE, CONFIG);
    await circuitBreaker.recordFailure(SERVICE, CONFIG);
    await circuitBreaker.recordFailure(SERVICE, CONFIG);
  });

  afterEach(() => jest.useRealTimers());

  it('should still block calls before cooldown expires', async () => {
    jest.advanceTimersByTime(CONFIG.cooldownMs - 1000); // 1s before cooldown

    await expect(circuitBreaker.isAllowed(SERVICE, CONFIG)).rejects.toThrow(
      CircuitOpenError,
    );
  });

  it('should allow a probe call after cooldown expires (HALF_OPEN)', async () => {
    jest.advanceTimersByTime(CONFIG.cooldownMs);

    await expect(
      circuitBreaker.isAllowed(SERVICE, CONFIG),
    ).resolves.not.toThrow();
    expect(await circuitBreaker.getState(SERVICE)).toBe(CircuitState.HALF_OPEN);
  });
});

// ─── HALF_OPEN → CLOSED / OPEN ────────────────────────────────────────────────

describe('HALF_OPEN transitions', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    // Open circuit and advance past cooldown → triggers HALF_OPEN on next isAllowed
    await circuitBreaker.recordFailure(SERVICE, CONFIG);
    await circuitBreaker.recordFailure(SERVICE, CONFIG);
    await circuitBreaker.recordFailure(SERVICE, CONFIG);
    jest.advanceTimersByTime(CONFIG.cooldownMs);
    await circuitBreaker.isAllowed(SERVICE, CONFIG); // transitions to HALF_OPEN
  });

  afterEach(() => jest.useRealTimers());

  it('should close circuit if probe succeeds', async () => {
    await circuitBreaker.recordSuccess(SERVICE);
    expect(await circuitBreaker.getState(SERVICE)).toBe(CircuitState.CLOSED);
  });

  it('should reopen circuit if probe fails', async () => {
    await circuitBreaker.recordFailure(SERVICE, CONFIG);
    expect(await circuitBreaker.getState(SERVICE)).toBe(CircuitState.OPEN);
  });
});

// ─── Reset ───────────────────────────────────────────────────────────────────

describe('reset', () => {
  it('should reset an open circuit back to CLOSED', async () => {
    await circuitBreaker.recordFailure(SERVICE, CONFIG);
    await circuitBreaker.recordFailure(SERVICE, CONFIG);
    await circuitBreaker.recordFailure(SERVICE, CONFIG);

    expect(await circuitBreaker.getState(SERVICE)).toBe(CircuitState.OPEN);

    await circuitBreaker.reset(SERVICE);

    expect(await circuitBreaker.getState(SERVICE)).toBe(CircuitState.CLOSED);
    await expect(
      circuitBreaker.isAllowed(SERVICE, CONFIG),
    ).resolves.not.toThrow();
  });
});
