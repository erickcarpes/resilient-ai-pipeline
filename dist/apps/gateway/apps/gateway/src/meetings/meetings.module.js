"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingsModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const nestjs_1 = require("@bull-board/nestjs");
const bullMQAdapter_1 = require("@bull-board/api/bullMQAdapter");
const shared_1 = require("../../../../libs/shared/src");
const meetings_controller_1 = require("./meetings.controller");
const meetings_service_1 = require("./meetings.service");
const meeting_redis_repository_1 = require("./repositories/meeting.redis.repository");
const meeting_repository_1 = require("./repositories/meeting.repository");
let MeetingsModule = class MeetingsModule {
};
exports.MeetingsModule = MeetingsModule;
exports.MeetingsModule = MeetingsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            bullmq_1.BullModule.registerQueue({ name: shared_1.QUEUE_NAMES.TRANSCRIPTION }),
            bullmq_1.BullModule.registerQueue({ name: shared_1.QUEUE_NAMES.CLEANING }, { name: shared_1.QUEUE_NAMES.INSIGHTS_SUMMARY }, { name: shared_1.QUEUE_NAMES.INSIGHTS_DEADLINES }),
            nestjs_1.BullBoardModule.forFeature({ name: shared_1.QUEUE_NAMES.TRANSCRIPTION, adapter: bullMQAdapter_1.BullMQAdapter }, { name: shared_1.QUEUE_NAMES.CLEANING, adapter: bullMQAdapter_1.BullMQAdapter }, { name: shared_1.QUEUE_NAMES.INSIGHTS_SUMMARY, adapter: bullMQAdapter_1.BullMQAdapter }, { name: shared_1.QUEUE_NAMES.INSIGHTS_DEADLINES, adapter: bullMQAdapter_1.BullMQAdapter }),
        ],
        controllers: [meetings_controller_1.MeetingsController],
        providers: [
            meetings_service_1.MeetingsService,
            {
                provide: meeting_repository_1.MEETING_REPOSITORY,
                useClass: meeting_redis_repository_1.MeetingRedisRepository,
            },
        ],
    })
], MeetingsModule);
//# sourceMappingURL=meetings.module.js.map