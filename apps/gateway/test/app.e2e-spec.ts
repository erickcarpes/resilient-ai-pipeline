import request = require('supertest');
import { randomUUID } from 'crypto';

const API_URL = process.env.API_URL || 'http://localhost:3001';

/**
 * BLACK-BOX E2E TESTS
 * Estes testes assumem que a infraestrutura (Redis) e os Workers
 * estão rodando (ex: via `npm run start:all:dev`).
 * Eles testam o sistema inteiro batendo no Gateway via HTTP.
 */
describe('Resilient AI Pipeline (e2e)', () => {
  // Função utilitária para fazer Polling (verificar o status a cada 1s)
  const pollMeetingStatus = async (
    meetingId: string,
    targetStatus: string,
    maxAttempts = 30,
  ) => {
    for (let i = 0; i < maxAttempts; i++) {
      const res = await request(API_URL).get(`/meetings/${meetingId}`);
      if (res.status === 200 && res.body.status === targetStatus) {
        return res.body;
      }
      // Se falhou (ainda na DLQ) e estamos esperando FAILED, retorna também
      if (
        res.status === 200 &&
        res.body.status === 'FAILED' &&
        targetStatus !== 'FAILED'
      ) {
        throw new Error(
          `Pipeline falhou inesperadamente: ${JSON.stringify(res.body)}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(
      `Meeting ${meetingId} não atingiu o status ${targetStatus} após ${maxAttempts} tentativas.`,
    );
  };

  it('1. Caminho Feliz: Deve processar uma reunião completa até o status COMPLETED', async () => {
    const meetingId = randomUUID();

    // 1. Submit
    const submitRes = await request(API_URL)
      .post('/meetings')
      .send({
        meetingId,
        title: 'E2E Happy Path Meeting',
        participants: ['Alice', 'Bob'],
        rawAudioText: 'This is a test transcript for the happy path.',
      })
      .expect(202);

    expect(submitRes.body.meetingId).toBe(meetingId);
    expect(submitRes.body.status).toBe('PENDING');

    // 2. Poll até finalizar
    const finalState = await pollMeetingStatus(meetingId, 'COMPLETED');

    // 3. Validações da Pipeline
    expect(finalState.pipeline.transcription).toBeDefined();
    expect(finalState.pipeline.cleaning).toBeDefined();
    expect(finalState.pipeline.summary).toBeDefined();
    expect(finalState.pipeline.deadlines).toBeDefined();
  }, 40000); // Timeout longo para dar tempo do BullMQ processar tudo

  it('2. Idempotência: Deve rejeitar duplicatas e retornar 200 OK com o estado atual', async () => {
    const meetingId = randomUUID();
    const payload = {
      meetingId,
      title: 'Idempotency Test',
      participants: ['Charlie'],
      rawAudioText: 'First try with enough characters to pass validation',
    };

    // Primeira submissão (202 Accepted)
    await request(API_URL).post('/meetings').send(payload).expect(202);

    // Segunda submissão IMEDIATA com o MESMO ID (200 OK)
    const secondRes = await request(API_URL)
      .post('/meetings')
      .send(payload)
      .expect(200);

    expect(secondRes.body.message).toContain('already submitted');
    expect(secondRes.body.meetingId).toBe(meetingId);
  });
});
