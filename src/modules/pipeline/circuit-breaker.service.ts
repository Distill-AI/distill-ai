import { Injectable, Logger } from '@nestjs/common';
import { env } from '@config/env';
import { RedisService } from '@modules/redis/redis.service';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CBState {
  state: CircuitBreakerState;
  consecutiveFailures: number;
  firstFailureAt: number | null;
  openedAt: number | null;
}

const CB_KEY = 'cb:llm:state';
const CB_TTL_S = 3600;

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  constructor(private readonly redis: RedisService) {}

  /** Returns the current breaker state, auto-transitioning OPEN -> HALF_OPEN once the cooldown elapses. */
  async getState(): Promise<CircuitBreakerState> {
    const s = await this.load();
    if (s.state === CircuitBreakerState.OPEN) {
      const now = Date.now();
      const cooldownMs = env.CIRCUIT_BREAKER_COOLDOWN_S * 1000;
      if (s.openedAt && now - s.openedAt >= cooldownMs) {
        await this.save({ ...s, state: CircuitBreakerState.HALF_OPEN });
        return CircuitBreakerState.HALF_OPEN;
      }
    }
    return s.state;
  }

  /** Returns true when the breaker is OPEN and all new LLM calls should be blocked. */
  async isOpen(): Promise<boolean> {
    return (await this.getState()) === CircuitBreakerState.OPEN;
  }

  /** Records a successful LLM call; resets the breaker if it was HALF_OPEN or CLOSED. */
  async recordSuccess(): Promise<void> {
    const s = await this.load();
    if (s.state === CircuitBreakerState.HALF_OPEN || s.state === CircuitBreakerState.CLOSED) {
      if (s.state === CircuitBreakerState.HALF_OPEN) {
        this.logger.log({
          event: 'circuit_breaker_probe_success',
          message: 'Probe succeeded, closing breaker',
        });
      }
      await this.reset();
    }
  }

  /** Records a failed LLM call; trips the breaker when the failure threshold is reached within the window. */
  async recordFailure(): Promise<void> {
    const s = await this.load();
    const now = Date.now();
    const windowMs = env.CIRCUIT_BREAKER_WINDOW_S * 1000;

    if (s.state === CircuitBreakerState.HALF_OPEN) {
      this.logger.warn({
        event: 'circuit_breaker_probe_failure',
        message: 'Probe failed, re-opening breaker',
      });
      await this.save({ ...s, state: CircuitBreakerState.OPEN, openedAt: now });
      return;
    }

    if (s.state === CircuitBreakerState.CLOSED) {
      if (s.firstFailureAt === null || now - s.firstFailureAt > windowMs) {
        await this.save({ ...s, firstFailureAt: now, consecutiveFailures: 1 });
      } else {
        const newFailures = s.consecutiveFailures + 1;
        if (newFailures >= env.CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
          this.logger.error({
            event: 'circuit_breaker_tripped',
            message: 'Failure threshold reached, opening breaker',
          });
          await this.save({
            ...s,
            consecutiveFailures: newFailures,
            state: CircuitBreakerState.OPEN,
            openedAt: now,
          });
        } else {
          await this.save({ ...s, consecutiveFailures: newFailures });
        }
      }
    }
  }

  private async load(): Promise<CBState> {
    const raw = await this.redis.get(CB_KEY);
    if (!raw) {
      return {
        state: CircuitBreakerState.CLOSED,
        consecutiveFailures: 0,
        firstFailureAt: null,
        openedAt: null,
      };
    }
    return JSON.parse(raw) as CBState;
  }

  private async save(state: CBState): Promise<void> {
    await this.redis.set(CB_KEY, JSON.stringify(state), CB_TTL_S);
  }

  private async reset(): Promise<void> {
    await this.save({
      state: CircuitBreakerState.CLOSED,
      consecutiveFailures: 0,
      firstFailureAt: null,
      openedAt: null,
    });
  }
}
