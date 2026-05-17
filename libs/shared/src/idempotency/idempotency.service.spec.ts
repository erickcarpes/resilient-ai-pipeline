// =============================================================================
// IDEMPOTENCY SERVICE — Unit Tests
// =============================================================================

import RedisMock from 'ioredis-mock';
import Redis from 'ioredis';
import { IdempotencyService } from './idempotency.service';

let redis: Redis;
let idempotency: IdempotencyService;

beforeEach(() => {
  redis = new RedisMock() as unknown as Redis;
  idempotency = new IdempotencyService(redis);
});

describe('buildKey', () => {
  it('should produce a namespaced key', () => {
    const key = idempotency.buildKey('transcription', 'meeting-abc:1');
    expect(key).toBe('idempotency:transcription:meeting-abc:1');
  });
});

describe('get', () => {
  it('should return null for an unknown key (cache miss)', async () => {
    const result = await idempotency.get('transcription', 'unknown-key');
    expect(result).toBeNull();
  });

  it('should return the cached value on a cache hit', async () => {
    const data = { transcript: 'Hello world', durationMs: 1200 };
    await idempotency.set('transcription', 'meeting-abc:1', data);

    const result = await idempotency.get<typeof data>('transcription', 'meeting-abc:1');
    expect(result).toEqual(data);
  });

  it('should deserialize complex objects correctly', async () => {
    const insights = {
      summary: 'Team discussed Q3 goals',
      actionPoints: ['Send report', 'Schedule follow-up'],
      deadlines: ['2025-07-01'],
      fallback: false,
    };
    await idempotency.set('insights', 'meeting-xyz:1', insights);

    const result = await idempotency.get<typeof insights>('insights', 'meeting-xyz:1');
    expect(result).toEqual(insights);
  });
});

describe('set', () => {
  it('should store a value that is then retrievable', async () => {
    await idempotency.set('cleaning', 'key-1', { cleaned: true });
    const result = await idempotency.get<{ cleaned: boolean }>('cleaning', 'key-1');
    expect(result?.cleaned).toBe(true);
  });

  it('should isolate keys by stage (no cross-stage collision)', async () => {
    const dataA = { transcript: 'raw text' };
    const dataB = { cleanedTranscript: 'clean text' };

    // Same idempotency key, different stages — should NOT collide
    await idempotency.set('transcription', 'meeting-abc:1', dataA);
    await idempotency.set('cleaning', 'meeting-abc:1', dataB);

    const resultA = await idempotency.get<typeof dataA>('transcription', 'meeting-abc:1');
    const resultB = await idempotency.get<typeof dataB>('cleaning', 'meeting-abc:1');

    expect(resultA).toEqual(dataA);
    expect(resultB).toEqual(dataB);
  });
});

describe('invalidate', () => {
  it('should delete the cached value', async () => {
    await idempotency.set('transcription', 'key-to-delete', { ok: true });
    await idempotency.invalidate('transcription', 'key-to-delete');

    const result = await idempotency.get('transcription', 'key-to-delete');
    expect(result).toBeNull();
  });
});
