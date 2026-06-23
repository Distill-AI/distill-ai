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
  openedAt: number | null;
}

const CB_KEY = 'cb:llm:state';
const CB_TTL_S = 3600;
// Window-bounded failure counter: separate key so it can be atomically INCR'd.
// TTL is set to CIRCUIT_BREAKER_WINDOW_S on first failure; Redis expires it automatically,
// which resets the window without any explicit firstFailureAt tracking.
const CB_FAILURES_KEY = 'cb:llm:failures';
const PROBE_LOCK_KEY = 'cb:llm:probe';
// Covers max LLM timeout (30s default) * (max retries + 2) with headroom, preventing a
// crashed probe from holding the lock indefinitely.
const PROBE_LOCK_TTL_S = 120;

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

  /** Returns true when the breaker is OPEN and all new LLM calls should be blocked.
   * In HALF_OPEN, permits exactly one probe call via a Redis lock; all other callers are blocked. */
  async isOpen(): Promise<boolean> {
    const state = await this.getState();
    if (state === CircuitBreakerState.OPEN) return true;
    if (state === CircuitBreakerState.HALF_OPEN) {
      const acquired = await this.redis.setNx(PROBE_LOCK_KEY, '1', PROBE_LOCK_TTL_S);
      return !acquired;
    }
    return false;
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

    if (s.state === CircuitBreakerState.HALF_OPEN) {
      this.logger.warn({
        event: 'circuit_breaker_probe_failure',
        message: 'Probe failed, re-opening breaker',
      });
      await this.redis.del(PROBE_LOCK_KEY);
      await this.save({ ...s, state: CircuitBreakerState.OPEN, openedAt: now });
      return;
    }

    if (s.state === CircuitBreakerState.CLOSED) {
      // setNx initializes the counter at 0 with the window TTL on the first failure.
      // Redis expires the key automatically after the window, resetting the count.
      // incr is atomic: concurrent callers get distinct counts, no increment is lost.
      await this.redis.setNx(CB_FAILURES_KEY, '0', env.CIRCUIT_BREAKER_WINDOW_S);
      const count = await this.redis.incr(CB_FAILURES_KEY);
      // null means Redis failed mid-window: trip the breaker rather than silently dropping the failure.
      if (count === null || count >= env.CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
        this.logger.error({
          event: 'circuit_breaker_tripped',
          message: 'Failure threshold reached, opening breaker',
        });
        await this.save({ ...s, state: CircuitBreakerState.OPEN, openedAt: now });
      }
    }
  }

  private async load(): Promise<CBState> {
    const raw = await this.redis.get(CB_KEY);
    if (!raw) {
      return { state: CircuitBreakerState.CLOSED, openedAt: null };
    }
    return JSON.parse(raw) as CBState;
  }

  private async save(state: CBState): Promise<void> {
    await this.redis.set(CB_KEY, JSON.stringify(state), CB_TTL_S);
  }

  private async reset(): Promise<void> {
    await this.redis.del(PROBE_LOCK_KEY);
    await this.redis.del(CB_FAILURES_KEY);
    await this.save({ state: CircuitBreakerState.CLOSED, openedAt: null });
  }
}
