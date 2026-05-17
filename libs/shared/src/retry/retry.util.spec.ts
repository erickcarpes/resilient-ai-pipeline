// =============================================================================
// RETRY UTILITIES — Unit Tests
// =============================================================================
// These tests cover PURE FUNCTIONS — no mocks needed, no async setup.
// This is the easiest kind of test to write and the most reliable.
//
// Notice: we use jest.useFakeTimers() to avoid actually waiting for timeouts.
// =============================================================================

import {
  addJitter,
  calculateBackoff,
  MaxRetriesExceededError,
  sleep,
  TimeoutError,
  withRetry,
  withTimeout,
} from './retry.util';

// ─── calculateBackoff ─────────────────────────────────────────────────────────

describe('calculateBackoff', () => {
  it('should return base delay on attempt 1 (2^0 = 1)', () => {
    expect(calculateBackoff(1, 1000)).toBe(1000);
  });

  it('should double delay on attempt 2 (2^1 = 2)', () => {
    expect(calculateBackoff(2, 1000)).toBe(2000);
  });

  it('should quadruple delay on attempt 3 (2^2 = 4)', () => {
    expect(calculateBackoff(3, 1000)).toBe(4000);
  });

  it('should work with different base delays', () => {
    expect(calculateBackoff(1, 500)).toBe(500);
    expect(calculateBackoff(2, 500)).toBe(1000);
    expect(calculateBackoff(3, 500)).toBe(2000);
  });
});

// ─── addJitter ────────────────────────────────────────────────────────────────

describe('addJitter', () => {
  it('should return a value >= the base delay', () => {
    // Jitter only adds, never subtracts
    for (let i = 0; i < 50; i++) {
      expect(addJitter(1000, 500)).toBeGreaterThanOrEqual(1000);
    }
  });

  it('should return a value < base delay + maxJitter', () => {
    for (let i = 0; i < 50; i++) {
      expect(addJitter(1000, 500)).toBeLessThan(1500);
    }
  });

  it('should use 500ms as default maxJitter', () => {
    for (let i = 0; i < 50; i++) {
      const result = addJitter(1000);
      expect(result).toBeGreaterThanOrEqual(1000);
      expect(result).toBeLessThan(1500);
    }
  });

  it('should return exactly the base delay when maxJitter is 0', () => {
    // Math.floor(random * 0) = 0 always
    expect(addJitter(1000, 0)).toBe(1000);
  });
});

// ─── sleep ────────────────────────────────────────────────────────────────────

describe('sleep', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('should resolve after the specified duration', async () => {
    const promise = sleep(1000);

    jest.advanceTimersByTime(999);
    // Not yet resolved — we can't easily assert this with fake timers,
    // but advancing to 1000 should resolve it
    jest.advanceTimersByTime(1);

    await expect(promise).resolves.toBeUndefined();
  });
});

// ─── withTimeout ─────────────────────────────────────────────────────────────

describe('withTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('should resolve if the promise completes before the timeout', async () => {
    const fast = Promise.resolve('success');
    const result = withTimeout(fast, 5000, 'FastOp');

    jest.runAllTimers();

    await expect(result).resolves.toBe('success');
  });

  it('should reject with TimeoutError if timeout elapses first', async () => {
    // A promise that never resolves
    const forever = new Promise<string>(() => {});
    const result = withTimeout(forever, 3000, 'SlowOp');

    jest.advanceTimersByTime(3000);

    await expect(result).rejects.toThrow(TimeoutError);
    await expect(result).rejects.toThrow('SlowOp timed out after 3000ms');
  });

  it('should reject if the original promise rejects before timeout', async () => {
    const failing = Promise.reject(new Error('API error'));
    const result = withTimeout(failing, 5000);

    jest.runAllTimers();

    await expect(result).rejects.toThrow('API error');
  });
});

// ─── withRetry ────────────────────────────────────────────────────────────────

describe('withRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global.Math, 'random').mockReturnValue(0); // Disable jitter
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.spyOn(global.Math, 'random').mockRestore();
  });

  // Helper: runs the promise and advances all pending timers concurrently.
  // This is necessary because withRetry uses sleep() internally which relies
  // on setTimeout — fake timers must be advanced WHILE the async fn is awaiting.
  async function runWithTimers<T>(promise: Promise<T>): Promise<T> {
    const result = Promise.allSettled([promise, jest.runAllTimersAsync()]);
    const [outcome] = await result;
    if (outcome.status === 'rejected') throw outcome.reason;
    return outcome.value;
  }

  it('should return the result immediately on first success', async () => {
    const fn = jest.fn().mockResolvedValue('transcript text');

    const result = await runWithTimers(
      withRetry(fn, { attempts: 3, baseDelayMs: 100 }),
    );

    expect(result).toBe('transcript text');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed on 2nd attempt', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValue('success on retry');

    const result = await runWithTimers(
      withRetry(fn, { attempts: 3, baseDelayMs: 100 }),
    );

    expect(result).toBe('success on retry');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw MaxRetriesExceededError after all attempts fail', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Service unavailable'));

    await expect(
      runWithTimers(withRetry(fn, { attempts: 3, baseDelayMs: 100 })),
    ).rejects.toThrow(MaxRetriesExceededError);

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should call onRetry callback with correct info on each failure', async () => {
    const onRetry = jest.fn();
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('ok');

    await runWithTimers(
      withRetry(fn, { attempts: 3, baseDelayMs: 1000, onRetry }),
    );

    expect(onRetry).toHaveBeenCalledTimes(2);
    // With Math.random = 0: jitter = 0, so delay = pure backoff
    // attempt 1 fails → delay = calculateBackoff(1, 1000) = 1000ms
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error), 1000);
    // attempt 2 fails → delay = calculateBackoff(2, 1000) = 2000ms
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error), 2000);
  });

  it('should preserve the last error in MaxRetriesExceededError', async () => {
    const lastErr = new Error('final failure');
    const fn = jest.fn().mockRejectedValue(lastErr);

    await expect(
      runWithTimers(withRetry(fn, { attempts: 2, baseDelayMs: 100 })),
    ).rejects.toMatchObject({
      name: 'MaxRetriesExceededError',
      lastError: lastErr,
      attempts: 2,
    });
  });
});
