import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = parseInt(process.env.INSIGHTS_SUMMARY_WORKER_PORT ?? '3004', 10);
  await app.listen(port);
  console.log(`🧠 Insights Summary Worker running on port ${port}`);
}
bootstrap();
