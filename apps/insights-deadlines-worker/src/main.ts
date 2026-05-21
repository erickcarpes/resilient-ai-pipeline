import '@pipeline/shared/observability/instrumentation';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const port = parseInt(
    process.env.INSIGHTS_DEADLINES_WORKER_PORT ?? '3005',
    10,
  );
  await app.listen(port);
}
bootstrap();
