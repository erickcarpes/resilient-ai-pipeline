// =============================================================================
// REDIS MODULE — NestJS Dynamic Module
// =============================================================================
// A "Dynamic Module" is a module whose providers are configured at runtime
// (i.e., you pass the config when you import it, not hardcoded).
//
// Usage in an app's AppModule:
//   RedisModule.forRoot({ host: 'localhost', port: 6379 })
//
// The `global: true` flag means: once imported in AppModule, the REDIS_CLIENT
// token is available EVERYWHERE in that app without re-importing.
//
// This is the same pattern used by @nestjs/typeorm, @nestjs/mongoose, etc.
// We're building our own to learn the pattern.
// =============================================================================

import { DynamicModule, Module } from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Module({})
export class RedisModule {
  /**
   * Creates a globally available Redis provider.
   *
   * `useFactory` is a provider strategy that allows async setup and dependency
   * injection during provider creation. Here we just construct the Redis client.
   *
   * Why `global: true`?
   * Without it, every module that needs Redis would have to import RedisModule.
   * With it, import once in AppModule → available everywhere. Less boilerplate.
   */
  static forRoot(options: RedisOptions): DynamicModule {
    const redisProvider = {
      provide: REDIS_CLIENT,
      useFactory: (): Redis => {
        const client = new Redis(options);

        client.on('connect', () =>
          console.log('[RedisModule] Connected to Redis'),
        );
        client.on('error', (err) =>
          console.error('[RedisModule] Redis error:', err.message),
        );

        return client;
      },
    };

    return {
      module: RedisModule,
      providers: [redisProvider],
      exports: [redisProvider], // Export so other modules can inject REDIS_CLIENT
      global: true, // Available across the entire app
    };
  }
}
