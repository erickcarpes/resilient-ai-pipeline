import { NestFactory } from '@nestjs/core';
import { InsightsWorkerModule } from './insights-worker.module';

async function bootstrap() {
  const app = await NestFactory.create(InsightsWorkerModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
