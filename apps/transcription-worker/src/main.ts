import { NestFactory } from '@nestjs/core';
import { TranscriptionWorkerModule } from './transcription-worker.module';

async function bootstrap() {
  const app = await NestFactory.create(TranscriptionWorkerModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
