// =============================================================================
// FAN-IN COORDINATION — Redis Key Builders & Constants
// =============================================================================
// When the Cleaning Worker fans-out to two parallel insights workers,
// they need to coordinate: "is the other worker done yet?"
//
// Mechanism (no dedicated aggregator service needed):
//   1. Each worker saves its result + marks itself as "done" in Redis
//   2. Each worker then checks: "is the other one done too?"
//   3. The SECOND worker to finish consolidates both results and
//      updates the Meeting state to COMPLETED/PARTIAL
//
// This is called "last-writer-wins fan-in" — simple, no extra service needed.
//
// Redis key layout:
//   fan-in:{meetingId}:summary:done     → '1'   (set by Summary Worker)
//   fan-in:{meetingId}:deadlines:done   → '1'   (set by Deadlines Worker)
//   fan-in:{meetingId}:summary:result   → JSON  (set by Summary Worker)
//   fan-in:{meetingId}:deadlines:result → JSON  (set by Deadlines Worker)
// =============================================================================

/** TTL for fan-in coordination keys. After 24h they're safe to expire. */
export const FAN_IN_TTL_SECONDS = 86400;

/**
 * Redis key builders for Fan-In coordination.
 * Centralizing these prevents key-naming bugs when workers check each other's state.
 *
 * @example
 * // In Summary Worker, after finishing:
 * await redis.setex(FAN_IN_KEYS.summaryDone(meetingId), FAN_IN_TTL_SECONDS, '1');
 * const isDeadlinesDone = await redis.exists(FAN_IN_KEYS.deadlinesDone(meetingId));
 */
export const FAN_IN_KEYS = {
  summaryDone: (meetingId: string) => `fan-in:${meetingId}:summary:done`,
  deadlinesDone: (meetingId: string) => `fan-in:${meetingId}:deadlines:done`,
  summaryResult: (meetingId: string) => `fan-in:${meetingId}:summary:result`,
  deadlinesResult: (meetingId: string) =>
    `fan-in:${meetingId}:deadlines:result`,
} as const;
