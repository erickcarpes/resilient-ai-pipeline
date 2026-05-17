import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { RedisModule, SharedModule } from '@pipeline/shared';
import { appConfig } from './config/app.config';
import { MeetingsModule } from './meetings/meetings.module';

@Module({
  imports: [
    // ── Config ──────────────────────────────────────────────────────────────
    // isGlobal: true → ConfigService available everywhere without re-importing
    // load: [appConfig] → registers our typed config factory
    // envFilePath: reads .env from project root (monorepo: ../../.env from apps/gateway/)
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: '../../.env',
    }),

    // ── Redis ────────────────────────────────────────────────────────────────
    // RedisModule.forRoot is our custom dynamic module (from @pipeline/shared).
    // We use forRootAsync to wait for ConfigService to be ready first.
    // This is the standard NestJS async factory pattern.
    RedisModule.forRoot({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    }),

    // ── BullMQ ───────────────────────────────────────────────────────────────
    // BullModule.forRootAsync wires the Redis connection from ConfigService.
    // All BullModule.registerQueue() calls in child modules use this connection.
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
        },
      }),
    }),

    // ── Bull Board ───────────────────────────────────────────────────────────
    // Sets up the /queues dashboard. ExpressAdapter integrates with NestJS.
    // Individual queues are registered per-feature in MeetingsModule.
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),

    // ── Shared + Feature Modules ─────────────────────────────────────────────
    SharedModule,
    MeetingsModule,
  ],
})
export class AppModule {}
