// =============================================================================
// JOB MODELS — Pipeline Processing Contracts
// =============================================================================
// These types represent the PIPELINE ARTIFACT, not the Meeting domain entity.
// The Meeting entity lives in the gateway (domain layer).
// The Job is what the pipeline system uses to track processing state.
//
// As a meeting moves through the pipeline, the payload ACCUMULATES data:
//   transcription:queue  →  cleaning:queue  →  insights:queue
//   (rawAudioText)           (+transcript)       (+cleanedText)
// =============================================================================

// ─── Job State Machine ────────────────────────────────────────────────────────
// This tracks WHERE in the pipeline a meeting currently is.
// Stored in Redis as: job:{meetingId}:state
export enum JobState {
  PENDING = 'PENDING',       // Received by gateway, not yet picked up
  TRANSCRIBING = 'TRANSCRIBING', // Transcription worker is processing it
  CLEANING = 'CLEANING',     // Cleaning worker is processing it
  EXTRACTING = 'EXTRACTING', // Insights worker is processing it
  COMPLETED = 'COMPLETED',   // Full pipeline finished successfully
  FAILED = 'FAILED',         // Exhausted all retries, sent to DLQ
  PARTIAL = 'PARTIAL',       // Pipeline finished, but insights used fallback
}

// ─── Queue Name Constants ─────────────────────────────────────────────────────
// Using constants instead of magic strings prevents typos and makes
// refactoring safer. If you rename a queue, you change it in ONE place.
export const QUEUE_NAMES = {
  TRANSCRIPTION: 'transcription',
  CLEANING: 'cleaning',
  INSIGHTS: 'insights',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ─── Stage Results ────────────────────────────────────────────────────────────
// Each worker produces one of these results and attaches it to the payload
// before publishing to the next queue.

export interface TranscriptionResult {
  transcript: string;        // The raw transcribed text (mocked)
  durationMs: number;        // How long the (mock) transcription took
  language: string;          // Detected language (e.g., 'pt-BR')
  processedAt: string;       // ISO timestamp
}

export interface CleaningResult {
  cleanedTranscript: string;   // Transcript without fillers, normalized
  removedFillerWords: number;  // Count of "uh", "um", "like" removed
  speakerCount: number;        // Estimated number of speakers
  processedAt: string;
}

export interface InsightsResult {
  summary: string | null;        // Executive summary (null on fallback)
  actionPoints: string[];        // "John will send the report by Friday"
  deadlines: string[];           // "Project delivery: 2025-06-30"
  attentionPoints: string[];     // "Budget concerns were raised"
  participants: string[];        // Identified participant names
  fallback: boolean;             // true = AI failed, returned degraded response
  fallbackReason?: string;       // Why fallback was triggered
  processedAt: string;
}

// ─── Pipeline Payload ─────────────────────────────────────────────────────────
// This is what flows through the queues. It starts minimal and accumulates
// data as each worker completes its stage.
//
// Why optional fields? Because:
//   - transcription stage receives payload WITHOUT transcription/cleaning
//   - cleaning stage receives payload WITH transcription, WITHOUT cleaning
//   - insights stage receives payload WITH transcription AND cleaning
//
// TypeScript's optional fields model this "accumulating" pattern cleanly.
export interface JobPayload {
  // ── Core identifiers ──────────────────────────────────────────────────────
  meetingId: string;         // Links back to the Meeting entity in gateway

  // Why a separate idempotencyKey?
  // If a meeting is reprocessed (e.g., admin retry), we want a NEW
  // idempotency key so workers don't return the cached (failed) result.
  // Format: "{meetingId}:{attempt}" e.g. "abc123:1", "abc123:2"
  idempotencyKey: string;

  // ── Input ─────────────────────────────────────────────────────────────────
  // In a real system this would be a URL to the audio file in S3.
  // We use a plain string to simulate audio content without real files.
  rawAudioText: string;

  submittedAt: string;       // ISO timestamp — when the meeting was submitted

  // ── Accumulated stage results (added as pipeline progresses) ──────────────
  transcription?: TranscriptionResult;
  cleaning?: CleaningResult;
  insights?: InsightsResult;
}

// ─── Job Status (stored in Redis for GET /jobs/:id) ───────────────────────────
export interface JobStatus {
  meetingId: string;
  state: JobState;
  idempotencyKey: string;
  submittedAt: string;
  updatedAt: string;
  error?: string;            // Last error message (if any)
  result?: {
    transcription?: TranscriptionResult;
    cleaning?: CleaningResult;
    insights?: InsightsResult;
  };
}
