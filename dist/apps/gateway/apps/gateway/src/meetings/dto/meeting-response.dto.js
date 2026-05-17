"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingStatusDto = exports.MeetingSubmittedDto = void 0;
class MeetingSubmittedDto {
    meetingId;
    status;
    message;
    checkAt;
}
exports.MeetingSubmittedDto = MeetingSubmittedDto;
class MeetingStatusDto {
    meetingId;
    title;
    participants;
    status;
    createdAt;
    updatedAt;
    error;
    pipeline;
    static fromEntity(meeting) {
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
exports.MeetingStatusDto = MeetingStatusDto;
//# sourceMappingURL=meeting-response.dto.js.map