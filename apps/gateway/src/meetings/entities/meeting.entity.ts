// =============================================================================
// MEETING ENTITY — Domain Object
// =============================================================================
// This is what the gateway KNOWS about a meeting.
// It's the business-facing record — different from the pipeline's JobPayload.
//
// MEETING vs JOB PAYLOAD:
//   Meeting     = "what is this meeting?" — persists forever, user-visible
//   JobPayload  = "how is processing going?" — ephemeral pipeline artifact
//
// The Meeting stores accumulated pipeline results so the user can see them
// via GET /meetings/:id without needing to query the pipeline state separately.
// =============================================================================

import type { SummaryResult, DeadlinesResult, TranscriptionResult, CleaningResult } from '@pipeline/shared';

export enum MeetingStatus {
  PENDING = 'PENDING',       // Submitted, waiting for transcription worker
  PROCESSING = 'PROCESSING', // At least one pipeline stage is active
  COMPLETED = 'COMPLETED',   // All stages finished successfully
  PARTIAL = 'PARTIAL',       // Pipeline finished but some stages used fallback
  FAILED = 'FAILED',         // Pipeline exhausted all retries
}

export interface Meeting {
  id: string;              // UUID — primary identifier
  title: string;           // Human-readable name for the meeting
  participants: string[];  // List of participant names
  rawAudioText: string;    // Simulated audio content (would be S3 URL in prod)
  status: MeetingStatus;

  // Unique key for idempotency at the pipeline level
  // Format: "{meetingId}:{attemptNumber}" — incremented on manual retry
  idempotencyKey: string;

  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp — updated on each stage completion
  error?: string;          // Last pipeline error (if failed)

  // Accumulated results from each pipeline stage
  // These are populated progressively as workers complete their stages
  pipeline?: {
    transcription?: TranscriptionResult;
    cleaning?: CleaningResult;
    summary?: SummaryResult;
    deadlines?: DeadlinesResult;
  };
}
