import { NestFactory } from '@nestjs/core';
import { CleaningWorkerModule } from './cleaning-worker.module';

async function bootstrap() {
  const app = await NestFactory.create(CleaningWorkerModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
