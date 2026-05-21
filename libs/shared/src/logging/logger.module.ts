import { Module } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import pretty from 'pino-pretty';
import { AppLogger } from './logger.service';
import { PINO_LOGGER } from './log.constants';

const PRETTY_OPTIONS = {
  colorize: true,
  singleLine: true,
  translateTime: 'SYS:standard',
  messageKey: 'message',
  ignore: 'pid,hostname',
};

@Module({
  providers: [
    {
      provide: PINO_LOGGER,
      useFactory: () => {
        const isProd = process.env.NODE_ENV === 'production';
        const logFile = process.env.LOG_FILE;
        const level = process.env.LOG_LEVEL ?? 'info';

        const baseOptions: pino.LoggerOptions = {
          level,
          base: undefined,
          timestamp: pino.stdTimeFunctions.isoTime,
          // Output level as string ("info") not pino's default number (30)
          // so it can be used directly as a Loki label without mapping.
          formatters: {
            level: (label) => ({ level: label }),
          },
        };

        // ── Streams ──────────────────────────────────────────────────────────
        // stdout: pretty in dev, raw JSON in prod
        // file:   raw JSON when LOG_FILE is set (read by Promtail → Loki)
        const streams: pino.StreamEntry[] = [
          {
            stream: isProd ? process.stdout : pretty(PRETTY_OPTIONS),
            level: level as pino.Level,
          },
        ];

        if (logFile) {
          fs.mkdirSync(path.dirname(logFile), { recursive: true });
          streams.push({
            stream: fs.createWriteStream(logFile, { flags: 'a' }),
            level: level as pino.Level,
          });
        }

        return pino(baseOptions, pino.multistream(streams));
      },
    },
    AppLogger,
  ],
  exports: [AppLogger],
})
export class LoggerModule {}
