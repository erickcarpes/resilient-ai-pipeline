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
var IdempotencyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotencyService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
const redis_constants_1 = require("../redis/redis.constants");
let IdempotencyService = IdempotencyService_1 = class IdempotencyService {
    redis;
    logger = new common_1.Logger(IdempotencyService_1.name);
    constructor(redis) {
        this.redis = redis;
    }
    buildKey(stage, idempotencyKey) {
        return `idempotency:${stage}:${idempotencyKey}`;
    }
    async get(stage, idempotencyKey) {
        const key = this.buildKey(stage, idempotencyKey);
        const raw = await this.redis.get(key);
        if (!raw)
            return null;
        this.logger.debug(`[Idempotency] Cache HIT for key: ${key}`);
        return JSON.parse(raw);
    }
    async set(stage, idempotencyKey, result, ttlSeconds = 86400) {
        const key = this.buildKey(stage, idempotencyKey);
        await this.redis.setex(key, ttlSeconds, JSON.stringify(result));
        this.logger.debug(`[Idempotency] Cached result for key: ${key} (TTL: ${ttlSeconds}s)`);
    }
    async invalidate(stage, idempotencyKey) {
        const key = this.buildKey(stage, idempotencyKey);
        await this.redis.del(key);
        this.logger.debug(`[Idempotency] Invalidated key: ${key}`);
    }
};
exports.IdempotencyService = IdempotencyService;
exports.IdempotencyService = IdempotencyService = IdempotencyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [ioredis_1.default])
], IdempotencyService);
//# sourceMappingURL=idempotency.service.js.map