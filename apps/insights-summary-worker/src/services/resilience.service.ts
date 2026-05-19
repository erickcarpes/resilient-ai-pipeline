import { Injectable } from '@nestjs/common';
import {
  CircuitBreakerService,
  type CircuitBreakerConfig,
  CircuitOpenError,
  withTimeout,
} from '@pipeline/shared';

export interface ResilienceOptions {
  timeoutMs: number;
  timeoutLabel?: string;
  circuitBreakerConfig: CircuitBreakerConfig;
}

@Injectable()
export class ResilienceService {
  constructor(private readonly cb: CircuitBreakerService) {}

  async execute<T>(
    service: string,
    fn: (signal: AbortSignal) => Promise<T>,
    options: ResilienceOptions,
  ): Promise<T> {
    await this.cb.isAllowed(service, options.circuitBreakerConfig);

    try {
      const result = await withTimeout(
        fn,
        options.timeoutMs,
        options.timeoutLabel ?? 'Operation',
      );
      await this.cb.recordSuccess(service);
      return result;
    } catch (err) {
      if (!(err instanceof CircuitOpenError)) {
        await this.cb.recordFailure(service, options.circuitBreakerConfig);
      }
      throw err;
    }
  }
}
