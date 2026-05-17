import { MeetingStatus } from '../entities/meeting.entity';
import type { Meeting } from '../entities/meeting.entity';

// Response shape for POST /meetings (202 Accepted)
export class MeetingSubmittedDto {
  meetingId: string;
  status: MeetingStatus;
  message: string;
  checkAt: string; // URL to poll for status: GET /meetings/:id
}

// Response shape for GET /meetings/:id (200 OK)
export class MeetingStatusDto {
  meetingId: string;
  title: string;
  participants: string[];
  status: MeetingStatus;
  createdAt: string;
  updatedAt: string;
  error?: string;
  pipeline?: Meeting['pipeline'];

  static fromEntity(meeting: Meeting): MeetingStatusDto {
    return {
      meetingId: meeting.id,
      title: meeting.title,
      participants: meeting.participants,
      status: meeting.status,
      createdAt: meeting.createdAt,
      updatedAt: meeting.updatedAt,
      error: meeting.error,
      pipeline: meeting.pipeline,
    };
  }
}
