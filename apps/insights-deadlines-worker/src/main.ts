import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = parseInt(
    process.env.INSIGHTS_DEADLINES_WORKER_PORT ?? '3005',
    10,
  );
  await app.listen(port);
  console.log(`📅 Insights Deadlines Worker running on port ${port}`);
}
bootstrap();
