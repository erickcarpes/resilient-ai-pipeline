"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUEUE_NAMES = exports.JobState = void 0;
var JobState;
(function (JobState) {
    JobState["PENDING"] = "PENDING";
    JobState["TRANSCRIBING"] = "TRANSCRIBING";
    JobState["CLEANING"] = "CLEANING";
    JobState["EXTRACTING"] = "EXTRACTING";
    JobState["COMPLETED"] = "COMPLETED";
    JobState["FAILED"] = "FAILED";
    JobState["PARTIAL"] = "PARTIAL";
})(JobState || (exports.JobState = JobState = {}));
exports.QUEUE_NAMES = {
    TRANSCRIPTION: 'transcription',
    CLEANING: 'cleaning',
    INSIGHTS_SUMMARY: 'insights-summary',
    INSIGHTS_DEADLINES: 'insights-deadlines',
};
//# sourceMappingURL=job.models.js.map