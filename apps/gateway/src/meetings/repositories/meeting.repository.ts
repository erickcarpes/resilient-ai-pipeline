// =============================================================================
// MEETING REPOSITORY — Interface (Contract)
// =============================================================================
// This is the Dependency Inversion Principle (DIP) in action.
//
// MeetingsService depends on THIS INTERFACE, not on any concrete implementation.
// The concrete implementation (Redis, Postgres, in-memory) is injected at runtime.
//
// WHY? So that:
//   - In tests: we inject an in-memory mock
//   - In production: we inject the Redis implementation
//   - In the future: we inject a Postgres implementation without touching the service
//
// This is identical to the pattern you used in Java with JpaRepository —
// the service only knows about the interface, never about the database driver.
// =============================================================================

import type { Meeting, MeetingStatus } from '../entities/meeting.entity';
import type {
  SummaryResult,
  DeadlinesResult,
  TranscriptionResult,
  CleaningResult,
} from '@pipeline/shared';

export const MEETING_REPOSITORY = Symbol('MEETING_REPOSITORY');

export interface IMeetingRepository {
  /**
   * Persists a new meeting or overwrites an existing one.
   */
  save(meeting: Meeting): Promise<void>;

  /**
   * Retrieves a meeting by its ID. Returns null if not found.
   */
  findById(id: string): Promise<Meeting | null>;

  /**
   * Updates only the status and optionally the error field.
   * Called by workers when pipeline state changes.
   */
  updateStatus(
    id: string,
    status: MeetingStatus,
    error?: string,
  ): Promise<void>;

  /**
   * Appends a pipeline stage result to the meeting's pipeline object.
   * Called by each worker when it completes its stage.
   */
  updatePipelineResult(
    id: string,
    stage: 'transcription' | 'cleaning' | 'summary' | 'deadlines',
    result:
      | TranscriptionResult
      | CleaningResult
      | SummaryResult
      | DeadlinesResult,
  ): Promise<void>;
}
