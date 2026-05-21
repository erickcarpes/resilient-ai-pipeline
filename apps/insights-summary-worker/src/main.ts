import '@pipeline/shared/observability/instrumentation';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const port = parseInt(process.env.INSIGHTS_SUMMARY_WORKER_PORT ?? '3004', 10);
  await app.listen(port);
}
bootstrap();
