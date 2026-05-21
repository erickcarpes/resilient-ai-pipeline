import { Inject, Injectable } from '@nestjs/common';
import { type Logger } from 'pino';
import { PINO_LOGGER } from './log.constants';
import type { LogContext, LogRecord } from './log.types';

@Injectable()
export class AppLogger {
  private logger: Logger;

  constructor(@Inject(PINO_LOGGER) logger: Logger) {
    this.logger = logger;
  }

  info(record: LogRecord, message?: string): void {
    this.logger.info(record, message);
  }

  warn(record: LogRecord, message?: string): void {
    this.logger.warn(record, message);
  }

  error(record: LogRecord, message?: string): void {
    this.logger.error(record, message);
  }

  child(context: LogContext): AppLogger {
    const childLogger = this.logger.child(context);
    const child = new AppLogger(childLogger);
    child.logger = childLogger;
    return child;
  }
}
