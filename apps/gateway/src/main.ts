import '@pipeline/shared/observability/instrumentation';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // ── Global Validation Pipe ─────────────────────────────────────────────────
  // Runs class-validator rules on every request body automatically.
  //
  // whitelist: true         → strips any property NOT in the DTO class
  // forbidNonWhitelisted    → throws 400 if client sends unknown properties
  // transform: true         → converts plain JSON to DTO class instances
  //                           (needed for class-validator to work)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = parseInt(process.env.GATEWAY_PORT ?? '3001', 10);
  await app.listen(port);
}

bootstrap();
