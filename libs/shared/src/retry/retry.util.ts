// =============================================================================
// RETRY UTILITIES — Pure Functions
// =============================================================================
// These are PURE FUNCTIONS: given the same input, always same output.
// No side effects. No dependencies. This makes them trivial to unit test.
//
// Why implement these ourselves if BullMQ already has retry?
//
//   BullMQ retry operates at the JOB level:
//     job fails → BullMQ re-enqueues after delay → worker picks it up again
//
//   Our retry operates at the SERVICE CALL level (WITHIN the worker):
//     mock API fails → we retry immediately → if exhausted → throw → BullMQ retries
//
//   Two separate layers of defense:
//     Layer 1 (ours):   3 fast retries within the worker process
//     Layer 2 (BullMQ): 5 slower retries at the queue level
//     Layer 3 (DLQ):    permanent failure → manual review
// =============================================================================

// ─── Custom Error Types ───────────────────────────────────────────────────────

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class MaxRetriesExceededError extends Error {
  public readonly lastError: Error;
  public readonly attempts: number;

  constructor(lastError: Error, attempts: number) {
    super(
      `Max retries (${attempts}) exceeded. Last error: ${lastError.message}`,
    );
    this.name = 'MaxRetriesExceededError';
    this.lastError = lastError;
    this.attempts = attempts;
  }
}

// ─── Core Utilities ───────────────────────────────────────────────────────────

/**
 * Returns a Promise that resolves after `ms` milliseconds.
 *
 * Accepts an optional AbortSignal. If the signal fires before the delay
 * completes, the timer is cleared and the promise rejects immediately with
 * an AbortError — preventing orphan code from running after a timeout.
 *
 * @example
 * // Inside a mock, cooperatively respect cancellation:
 * await sleep(15_000, signal);  // exits immediately when aborted
 */
export const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Sleep aborted', 'AbortError'));
      return;
    }

    const timer = setTimeout(resolve, ms);

    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Sleep aborted', 'AbortError'));
      },
      { once: true },
    );
  });

/**
 * Races a factory function against a timeout, with cooperative cancellation.
 *
 * Unlike a naive `Promise.race([promise, timeout])`, this version passes an
 * AbortSignal to the factory so the callee can exit cleanly when the timeout
 * fires — preventing orphan logs, wasted CPU, and double side-effects.
 *
 * If the factory resolves/rejects before `ms`: cleans up the timer and
 * returns/rethrows normally.
 * If `ms` elapses first: aborts the signal and rejects with TimeoutError.
 *
 * @param fn    - Factory that receives an AbortSignal and returns a Promise.
 * @param ms    - Timeout in milliseconds.
 * @param label - Human-readable label used in the TimeoutError message.
 *
 * @example
 * const result = await withTimeout(
 *   (signal) => mockTranscriber.transcribe(payload, signal),
 *   5000,
 *   'TranscriptionAPI',
 * );
 */
export const withTimeout = <T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms: number,
  label = 'Operation',
): Promise<T> => {
  const controller = new AbortController();
  const { signal } = controller;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError(`${label} timed out after ${ms}ms`));
    }, ms);

    fn(signal).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        // Swallow AbortError — it was triggered by our own timeout above.
        // The TimeoutError rejection above is the authoritative signal.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        reject(err);
      },
    );
  });
};

/**
 * Calculates exponential backoff delay.
 *
 * Formula: baseDelayMs * 2^(attempt - 1)
 *
 * Example with baseDelayMs = 1000:
 *   attempt 1 → 1000ms  (1000 * 2^0)
 *   attempt 2 → 2000ms  (1000 * 2^1)
 *   attempt 3 → 4000ms  (1000 * 2^2)
 *   attempt 4 → 8000ms  (1000 * 2^3)
 *
 * Why exponential? Because if a service is overloaded, linear retries
 * (retry every 1s) keep hammering it. Exponential retries give it space
 * to recover, while still retrying quickly for transient errors.
 */
export const calculateBackoff = (
  attempt: number,
  baseDelayMs: number,
): number => baseDelayMs * Math.pow(2, attempt - 1);

/**
 * Adds random jitter to a delay.
 *
 * WITHOUT jitter:
 *   100 requests all fail at t=0
 *   All retry at t=1000ms → thundering herd → service gets hammered again
 *   All retry at t=2000ms → still hammered → never recovers
 *
 * WITH jitter:
 *   100 requests all fail at t=0
 *   Retry window: t=1000ms to t=1500ms → load spread out → service recovers
 *
 * This is "Full Jitter" strategy: delay = random(0, backoff)
 * We use "Equal Jitter": delay = backoff + random(0, maxJitter)
 * Equal Jitter ensures minimum wait time while still spreading the load.
 */
export const addJitter = (delayMs: number, maxJitterMs = 500): number =>
  delayMs + Math.floor(Math.random() * maxJitterMs);

// ─── Retry Orchestrator ───────────────────────────────────────────────────────

export interface RetryOptions {
  /** Total number of attempts (including the first one). */
  attempts: number;
  /** Base delay in milliseconds for exponential backoff. */
  baseDelayMs: number;
  /** Maximum random jitter added to each delay. Default: 500ms. */
  maxJitterMs?: number;
  /** Human-readable label for logging. */
  label?: string;
  /**
   * Optional predicate to decide whether a failure should be retried.
   * Return false to abort retries and rethrow the original error.
   */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /**
   * Optional callback invoked BEFORE each retry.
   * Use this to log retry attempts in your workers.
   *
   * @param attempt - The attempt number that just FAILED (1-based)
   * @param error   - The error from the failed attempt
   * @param nextDelayMs - How long we'll wait before the next attempt
   */
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
}

/**
 * Executes `fn` with exponential backoff + jitter retry logic.
 *
 * @example
 * const transcript = await withRetry(
 *   () => withTimeout(mockTranscriber.transcribe(payload), 5000),
 *   {
 *     attempts: 3,
 *     baseDelayMs: 500,
 *     label: 'TranscriptionAPI',
 *     onRetry: (attempt, err, delay) =>
 *       logger.warn(`Retry ${attempt}: ${err.message}. Next in ${delay}ms`),
 *   }
 * );
 */
export const withRetry = async <T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> => {
  let lastError!: Error;

  for (let attempt = 1; attempt <= opts.attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (opts.shouldRetry && !opts.shouldRetry(lastError, attempt)) {
        throw lastError;
      }

      // If this was the last attempt, stop immediately (no sleep after final fail)
      if (attempt === opts.attempts) break;

      const backoff = calculateBackoff(attempt, opts.baseDelayMs);
      const delay = addJitter(backoff, opts.maxJitterMs);

      opts.onRetry?.(attempt, lastError, delay);

      await sleep(delay);
    }
  }

  throw new MaxRetriesExceededError(lastError, opts.attempts);
};
