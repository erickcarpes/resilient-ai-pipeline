// =============================================================================
// REDIS INJECTION TOKEN
// =============================================================================
// NestJS uses "injection tokens" to identify what to inject into a constructor.
// This is the token our services use to receive the Redis client:
//
//   constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}
//
// Why not just use the class itself as a token?
// Because we want to swap out the REAL Redis for a MOCK Redis in tests
// without changing the service code. The token is the abstraction layer.
// =============================================================================

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
