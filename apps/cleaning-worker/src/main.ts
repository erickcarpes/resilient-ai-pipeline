import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = parseInt(process.env.CLEANING_WORKER_PORT ?? '3003', 10);
  await app.listen(port);
  console.log(`🧹 Cleaning Worker running on port ${port}`);
}
bootstrap();
