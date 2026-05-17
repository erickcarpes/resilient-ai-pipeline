"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MeetingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingsService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const crypto_1 = require("crypto");
const shared_1 = require("../../../../libs/shared/src");
const meeting_entity_1 = require("./entities/meeting.entity");
const meeting_repository_1 = require("./repositories/meeting.repository");
const meeting_response_dto_1 = require("./dto/meeting-response.dto");
let MeetingsService = MeetingsService_1 = class MeetingsService {
    meetingRepository;
    transcriptionQueue;
    logger = new common_1.Logger(MeetingsService_1.name);
    constructor(meetingRepository, transcriptionQueue) {
        this.meetingRepository = meetingRepository;
        this.transcriptionQueue = transcriptionQueue;
    }
    async submit(dto) {
        const meetingId = dto.meetingId ?? (0, crypto_1.randomUUID)();
        const existing = await this.meetingRepository.findById(meetingId);
        if (existing) {
            this.logger.log(`[${meetingId}] Idempotent request — returning existing meeting state`);
            return {
                meetingId: existing.id,
                status: existing.status,
                message: 'Meeting already submitted. Check current status.',
                checkAt: `/meetings/${existing.id}`,
            };
        }
        const now = new Date().toISOString();
        const idempotencyKey = `${meetingId}:1`;
        const meeting = {
            id: meetingId,
            title: dto.title,
            participants: dto.participants,
            rawAudioText: dto.rawAudioText,
            status: meeting_entity_1.MeetingStatus.PENDING,
            idempotencyKey,
            createdAt: now,
            updatedAt: now,
        };
        await this.meetingRepository.save(meeting);
        const payload = {
            meetingId,
            idempotencyKey,
            rawAudioText: dto.rawAudioText,
            submittedAt: now,
        };
        await this.transcriptionQueue.add('process', payload, {
            jobId: meetingId,
            attempts: 5,
            backoff: {
                type: 'exponential',
                delay: 1000,
            },
            removeOnComplete: { count: 100 },
            removeOnFail: false,
        });
        this.logger.log(`[${meetingId}] Meeting submitted → transcription queue`);
        return {
            meetingId,
            status: meeting_entity_1.MeetingStatus.PENDING,
            message: 'Meeting accepted for processing',
            checkAt: `/meetings/${meetingId}`,
        };
    }
    async findById(id) {
        const meeting = await this.meetingRepository.findById(id);
        if (!meeting) {
            throw new common_1.NotFoundException(`Meeting ${id} not found`);
        }
        return meeting_response_dto_1.MeetingStatusDto.fromEntity(meeting);
    }
};
exports.MeetingsService = MeetingsService;
exports.MeetingsService = MeetingsService = MeetingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(meeting_repository_1.MEETING_REPOSITORY)),
    __param(1, (0, bullmq_1.InjectQueue)(shared_1.QUEUE_NAMES.TRANSCRIPTION)),
    __metadata("design:paramtypes", [Object, bullmq_2.Queue])
], MeetingsService);
//# sourceMappingURL=meetings.service.js.map