"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FAN_IN_KEYS = exports.FAN_IN_TTL_SECONDS = void 0;
exports.FAN_IN_TTL_SECONDS = 86400;
exports.FAN_IN_KEYS = {
    summaryDone: (meetingId) => `fan-in:${meetingId}:summary:done`,
    deadlinesDone: (meetingId) => `fan-in:${meetingId}:deadlines:done`,
    summaryResult: (meetingId) => `fan-in:${meetingId}:summary:result`,
    deadlinesResult: (meetingId) => `fan-in:${meetingId}:deadlines:result`,
};
//# sourceMappingURL=fan-in.constants.js.map