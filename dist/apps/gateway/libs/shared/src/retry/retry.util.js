"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withRetry = exports.withTimeout = exports.addJitter = exports.calculateBackoff = exports.sleep = exports.MaxRetriesExceededError = exports.TimeoutError = void 0;
class TimeoutError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TimeoutError';
    }
}
exports.TimeoutError = TimeoutError;
class MaxRetriesExceededError extends Error {
    lastError;
    attempts;
    constructor(lastError, attempts) {
        super(`Max retries (${attempts}) exceeded. Last error: ${lastError.message}`);
        this.name = 'MaxRetriesExceededError';
        this.lastError = lastError;
        this.attempts = attempts;
    }
}
exports.MaxRetriesExceededError = MaxRetriesExceededError;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
exports.sleep = sleep;
const calculateBackoff = (attempt, baseDelayMs) => baseDelayMs * Math.pow(2, attempt - 1);
exports.calculateBackoff = calculateBackoff;
const addJitter = (delayMs, maxJitterMs = 500) => delayMs + Math.floor(Math.random() * maxJitterMs);
exports.addJitter = addJitter;
const withTimeout = (promise, ms, label = 'Operation') => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new TimeoutError(`${label} timed out after ${ms}ms`)), ms)),
]);
exports.withTimeout = withTimeout;
const withRetry = async (fn, opts) => {
    let lastError;
    for (let attempt = 1; attempt <= opts.attempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt === opts.attempts)
                break;
            const backoff = (0, exports.calculateBackoff)(attempt, opts.baseDelayMs);
            const delay = (0, exports.addJitter)(backoff, opts.maxJitterMs);
            opts.onRetry?.(attempt, lastError, delay);
            await (0, exports.sleep)(delay);
        }
    }
    throw new MaxRetriesExceededError(lastError, opts.attempts);
};
exports.withRetry = withRetry;
//# sourceMappingURL=retry.util.js.map