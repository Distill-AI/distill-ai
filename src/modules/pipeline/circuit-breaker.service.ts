import { Injectable, Logger } from '@nestjs/common';
import { env } from '@config/env';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private consecutiveFailures = 0;
  private firstFailureAt: number | null = null;
  private openedAt: number | null = null;

  getState(): CircuitBreakerState {
    if (this.state === CircuitBreakerState.OPEN) {
      const now = Date.now();
      const cooldownMs = env.CIRCUIT_BREAKER_COOLDOWN_S * 1000;
      if (this.openedAt && now - this.openedAt >= cooldownMs) {
        this.transitionTo(CircuitBreakerState.HALF_OPEN);
      }
    }
    return this.state;
  }

  isOpen(): boolean {
    return this.getState() === CircuitBreakerState.OPEN;
  }

  recordSuccess(): void {
    if (this.state === CircuitBreakerState.HALF_OPEN || this.state === CircuitBreakerState.CLOSED) {
      if (this.state === CircuitBreakerState.HALF_OPEN) {
        this.logger.log({
          event: 'circuit_breaker_probe_success',
          message: 'Probe succeeded, closing breaker',
        });
      }
      this.reset();
    }
  }

  recordFailure(): void {
    const now = Date.now();
    const windowMs = env.CIRCUIT_BREAKER_WINDOW_S * 1000;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.logger.warn({
        event: 'circuit_breaker_probe_failure',
        message: 'Probe failed, re-opening breaker',
      });
      this.transitionTo(CircuitBreakerState.OPEN);
      return;
    }

    if (this.state === CircuitBreakerState.CLOSED) {
      if (this.firstFailureAt === null || now - this.firstFailureAt > windowMs) {
        this.firstFailureAt = now;
        this.consecutiveFailures = 1;
      } else {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= 2) {
          this.logger.error({
            event: 'circuit_breaker_tripped',
            message: 'Failure threshold reached, opening breaker',
          });
          this.transitionTo(CircuitBreakerState.OPEN);
        }
      }
    }
  }

  private transitionTo(newState: CircuitBreakerState): void {
    this.state = newState;
    if (newState === CircuitBreakerState.OPEN) {
      this.openedAt = Date.now();
    } else if (newState === CircuitBreakerState.CLOSED) {
      this.reset();
    }
  }

  private reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.consecutiveFailures = 0;
    this.firstFailureAt = null;
    this.openedAt = null;
  }
}
