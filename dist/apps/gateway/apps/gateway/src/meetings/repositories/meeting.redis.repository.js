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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingRedisRepository = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
const shared_1 = require("../../../../../libs/shared/src");
let MeetingRedisRepository = class MeetingRedisRepository {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    key(id) {
        return `meeting:${id}`;
    }
    async save(meeting) {
        await this.redis.set(this.key(meeting.id), JSON.stringify(meeting));
    }
    async findById(id) {
        const raw = await this.redis.get(this.key(id));
        if (!raw)
            return null;
        return JSON.parse(raw);
    }
    async updateStatus(id, status, error) {
        const meeting = await this.findById(id);
        if (!meeting)
            return;
        meeting.status = status;
        meeting.updatedAt = new Date().toISOString();
        if (error)
            meeting.error = error;
        await this.save(meeting);
    }
    async updatePipelineResult(id, stage, result) {
        const meeting = await this.findById(id);
        if (!meeting)
            return;
        meeting.pipeline = meeting.pipeline ?? {};
        meeting.pipeline[stage] = result;
        meeting.updatedAt = new Date().toISOString();
        await this.save(meeting);
    }
};
exports.MeetingRedisRepository = MeetingRedisRepository;
exports.MeetingRedisRepository = MeetingRedisRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(shared_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [ioredis_1.default])
], MeetingRedisRepository);
//# sourceMappingURL=meeting.redis.repository.js.map