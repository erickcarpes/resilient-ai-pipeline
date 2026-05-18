// Meeting domain entity — shared across gateway and all workers
import type {
  TranscriptionResult,
  CleaningResult,
  SummaryResult,
  DeadlinesResult,
} from './job.models';

export enum MeetingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
}

export interface Meeting {
  id: string;
  title: string;
  participants: string[];
  rawAudioText: string;
  status: MeetingStatus;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
  pipeline?: {
    transcription?: TranscriptionResult;
    cleaning?: CleaningResult;
    summary?: SummaryResult;
    deadlines?: DeadlinesResult;
  };
}
