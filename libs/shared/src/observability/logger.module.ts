import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'debug',
        // In local development, we want human-readable logs.
        // In production, we want raw JSON for Loki/OTel.
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                  translateTime: 'SYS:standard',
                  messageKey: 'message',
                  ignore: 'pid,hostname,context',
                  messageFormat: '[{context}] {message}',
                },
              }
            : undefined,
        messageKey: 'message',
        autoLogging: false, // Don't log every single HTTP request automatically
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
