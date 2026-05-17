"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bullmq_1 = require("@nestjs/bullmq");
const nestjs_1 = require("@bull-board/nestjs");
const express_1 = require("@bull-board/express");
const shared_1 = require("../../../libs/shared/src");
const app_config_1 = require("./config/app.config");
const meetings_module_1 = require("./meetings/meetings.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [app_config_1.appConfig],
                envFilePath: '../../.env',
            }),
            shared_1.RedisModule.forRoot({
                host: process.env.REDIS_HOST ?? 'localhost',
                port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
            }),
            bullmq_1.BullModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    connection: {
                        host: config.get('redis.host'),
                        port: config.get('redis.port'),
                    },
                }),
            }),
            nestjs_1.BullBoardModule.forRoot({
                route: '/queues',
                adapter: express_1.ExpressAdapter,
            }),
            shared_1.SharedModule,
            meetings_module_1.MeetingsModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map