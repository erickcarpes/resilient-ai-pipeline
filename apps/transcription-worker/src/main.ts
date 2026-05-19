import '@pipeline/shared/observability/instrumentation';
import { NestFactory } from '@nestjs/core';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(new LoggerErrorInterceptor());
  const logger = app.get(Logger);
  const port = parseInt(process.env.TRANSCRIPTION_WORKER_PORT ?? '3002', 10);
  await app.listen(port);
  logger.log(`Transcription worker running on port ${port}`);
}
bootstrap();
