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
var CircuitBreakerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreakerService = exports.CircuitOpenError = exports.CircuitState = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
const redis_constants_1 = require("../redis/redis.constants");
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
class CircuitOpenError extends Error {
    constructor(service, cooldownRemainingMs) {
        super(`Circuit breaker for "${service}" is OPEN. ` +
            `Failing fast. Cooldown remaining: ~${Math.ceil(cooldownRemainingMs / 1000)}s`);
        this.name = 'CircuitOpenError';
    }
}
exports.CircuitOpenError = CircuitOpenError;
let CircuitBreakerService = CircuitBreakerService_1 = class CircuitBreakerService {
    redis;
    logger = new common_1.Logger(CircuitBreakerService_1.name);
    constructor(redis) {
        this.redis = redis;
    }
    stateKey(service) {
        return `cb:${service}:state`;
    }
    failuresKey(service) {
        return `cb:${service}:failures`;
    }
    openedAtKey(service) {
        return `cb:${service}:opened_at`;
    }
    async getState(service) {
        const state = await this.redis.get(this.stateKey(service));
        return state ?? CircuitState.CLOSED;
    }
    async isAllowed(service, config) {
        const state = await this.getState(service);
        if (state === CircuitState.CLOSED || state === CircuitState.HALF_OPEN) {
            return;
        }
        const openedAt = await this.redis.get(this.openedAtKey(service));
        const elapsed = Date.now() - Number(openedAt);
        const remaining = config.cooldownMs - elapsed;
        if (elapsed >= config.cooldownMs) {
            await this.redis.set(this.stateKey(service), CircuitState.HALF_OPEN);
            this.logger.warn(`[${service}] Circuit: OPEN → HALF_OPEN (probing recovery)`);
            return;
        }
        throw new CircuitOpenError(service, remaining);
    }
    async recordSuccess(service) {
        const previousState = await this.getState(service);
        await Promise.all([
            this.redis.set(this.stateKey(service), CircuitState.CLOSED),
            this.redis.del(this.failuresKey(service)),
            this.redis.del(this.openedAtKey(service)),
        ]);
        if (previousState !== CircuitState.CLOSED) {
            this.logger.log(`[${service}] Circuit: ${previousState} → CLOSED ✅`);
        }
    }
    async recordFailure(service, config) {
        const state = await this.getState(service);
        if (state === CircuitState.HALF_OPEN) {
            await this.redis.set(this.stateKey(service), CircuitState.OPEN);
            await this.redis.set(this.openedAtKey(service), String(Date.now()));
            this.logger.error(`[${service}] Circuit: HALF_OPEN → OPEN 🔴 (probe failed)`);
            return;
        }
        if (state === CircuitState.OPEN) {
            return;
        }
        const failures = await this.redis.incr(this.failuresKey(service));
        this.logger.warn(`[${service}] Circuit: failure ${failures}/${config.failureThreshold}`);
        if (failures >= config.failureThreshold) {
            await this.redis.set(this.stateKey(service), CircuitState.OPEN);
            await this.redis.set(this.openedAtKey(service), String(Date.now()));
            this.logger.error(`[${service}] Circuit: CLOSED → OPEN 🔴 (${failures} consecutive failures)`);
        }
    }
    async reset(service) {
        await Promise.all([
            this.redis.del(this.stateKey(service)),
            this.redis.del(this.failuresKey(service)),
            this.redis.del(this.openedAtKey(service)),
        ]);
        this.logger.log(`[${service}] Circuit: manually reset to CLOSED`);
    }
};
exports.CircuitBreakerService = CircuitBreakerService;
exports.CircuitBreakerService = CircuitBreakerService = CircuitBreakerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [ioredis_1.default])
], CircuitBreakerService);
//# sourceMappingURL=circuit-breaker.service.js.map