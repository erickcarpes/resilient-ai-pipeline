// =============================================================================
// JOB MODELS — Pipeline Processing Contracts (v2 — Fan-Out/Fan-In)
// =============================================================================
// Pipeline flow (updated for parallel insights extraction):
//
//   transcription:queue
//       ↓ (Transcription Worker)
//   cleaning:queue
//       ↓ (Cleaning Worker — Fan-Out)
//       ├─▶ insights-summary:queue   (Summary Worker)
//       └─▶ insights-deadlines:queue (Deadlines Worker)
//                           ↓ (Fan-In — second worker to finish consolidates)
//                       COMPLETED | PARTIAL | FAILED
// =============================================================================

// ─── Job State Machine ────────────────────────────────────────────────────────
export enum JobState {
  PENDING = 'PENDING', // Received by gateway, not yet picked up
  TRANSCRIBING = 'TRANSCRIBING', // Transcription worker is processing it
  CLEANING = 'CLEANING', // Cleaning worker is processing it
  EXTRACTING = 'EXTRACTING', // BOTH insights workers running in parallel (Fan-Out)
  COMPLETED = 'COMPLETED', // Fan-In complete — full pipeline finished successfully
  FAILED = 'FAILED', // Exhausted all retries, sent to DLQ
  PARTIAL = 'PARTIAL', // Pipeline finished, but one or both insights used fallback
}

// ─── Queue Name Constants ─────────────────────────────────────────────────────
// Single source of truth for queue names.
// All apps import from here — no magic strings scattered across workers.
export const QUEUE_NAMES = {
  TRANSCRIPTION: 'transcription',
  CLEANING: 'cleaning',
  // Fan-Out: Cleaning Worker publishes to BOTH of these simultaneously
  INSIGHTS_SUMMARY: 'insights-summary',
  INSIGHTS_DEADLINES: 'insights-deadlines',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ─── Stage Results ────────────────────────────────────────────────────────────

export interface TranscriptionResult {
  transcript: string; // The raw transcribed text (mocked)
  durationMs: number; // How long the (mock) transcription took
  language: string; // Detected language (e.g., 'pt-BR')
  processedAt: string; // ISO timestamp
}

export interface CleaningResult {
  cleanedTranscript: string; // Transcript without fillers, normalized
  removedFillerWords: number; // Count of "uh", "um", "like" removed
  speakerCount: number; // Estimated number of speakers
  processedAt: string;
}

// ── Fan-Out Stage Results (produced by parallel workers) ──────────────────────

/**
 * Produced by the INSIGHTS SUMMARY Worker.
 * Focuses on: what was decided, who does what, what needs attention.
 */
export interface SummaryResult {
  summary: string | null; // Executive summary of the meeting
  actionPoints: string[]; // "John will send the report by Friday"
  attentionPoints: string[]; // "Budget concerns were raised"
  participants: string[]; // Identified participant names
  fallback: boolean; // true = AI failed, returned degraded response
  fallbackReason?: string;
  processedAt: string;
}

/**
 * Produced by the INSIGHTS DEADLINES Worker.
 * Focuses on: temporal commitments, dates, follow-ups.
 */
export interface DeadlinesResult {
  deadlines: string[]; // "Project delivery: 2025-06-30"
  keyDates: string[]; // Other mentioned dates without hard deadlines
  followUpItems: string[]; // Items that need follow-up but no date set
  fallback: boolean;
  fallbackReason?: string;
  processedAt: string;
}

// ─── Pipeline Payload ─────────────────────────────────────────────────────────
// Flows through queues, accumulating results at each stage.
// Both insights workers receive the SAME payload (post-cleaning).
// Each writes its result to Redis for Fan-In coordination.
export interface JobPayload {
  meetingId: string; // Links back to the Meeting entity in gateway
  idempotencyKey: string; // "{meetingId}:{attempt}" — unique per processing attempt
  rawAudioText: string; // Simulated audio content
  submittedAt: string; // ISO timestamp

  // Accumulated as pipeline progresses
  transcription?: TranscriptionResult;
  cleaning?: CleaningResult;

  // Fan-Out results — each set independently by their respective worker
  summaryResult?: SummaryResult;
  deadlinesResult?: DeadlinesResult;
}

// ─── Job Status (API response for GET /meetings/:id) ─────────────────────────
export interface JobStatus {
  meetingId: string;
  state: JobState;
  idempotencyKey: string;
  submittedAt: string;
  updatedAt: string;
  error?: string; // Last error message (if any)
  result?: {
    transcription?: TranscriptionResult;
    cleaning?: CleaningResult;
    summary?: SummaryResult;
    deadlines?: DeadlinesResult;
  };
}
