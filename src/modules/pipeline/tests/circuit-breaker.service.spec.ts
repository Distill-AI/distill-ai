import { CircuitBreakerService, CircuitBreakerState } from '../circuit-breaker.service';
import type { RedisService } from '@modules/redis/redis.service';

vi.mock('@config/env', () => ({
  env: {
    CIRCUIT_BREAKER_WINDOW_S: 60,
    CIRCUIT_BREAKER_COOLDOWN_S: 30,
    CIRCUIT_BREAKER_FAILURE_THRESHOLD: 2,
  },
}));

function makeRedis() {
  let stored: string | null = null;
  return {
    get: vi.fn(async (_key: string) => stored as string | null),
    set: vi.fn(async (_key: string, value: string, _ttl?: number): Promise<void> => {
      stored = value;
    }),
  };
}

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;
  let mockRedis: ReturnType<typeof makeRedis>;

  beforeEach(() => {
    mockRedis = makeRedis();
    service = new CircuitBreakerService(mockRedis as unknown as RedisService);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('starts CLOSED', async () => {
      expect(await service.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(await service.isOpen()).toBe(false);
    });
  });

  describe('AC-03: opens after two consecutive failures within 60s', () => {
    it('stays CLOSED after one failure', async () => {
      await service.recordFailure();
      expect(await service.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('opens after two consecutive failures within the window', async () => {
      await service.recordFailure();
      vi.advanceTimersByTime(10_000); // 10s later, within 60s window
      await service.recordFailure();
      expect(await service.getState()).toBe(CircuitBreakerState.OPEN);
      expect(await service.isOpen()).toBe(true);
    });

    it('does NOT open if the second failure is outside the 60s window', async () => {
      await service.recordFailure();
      vi.advanceTimersByTime(61_000); // outside the window
      await service.recordFailure();
      expect(await service.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('AC-04: open breaker skips calls immediately', () => {
    it('isOpen() returns true when breaker is OPEN', async () => {
      await service.recordFailure();
      await service.recordFailure();
      expect(await service.isOpen()).toBe(true);
    });
  });

  describe('AC-05: half-opens after 30s cooldown, closes on success', () => {
    it('transitions to HALF_OPEN after cooldown', async () => {
      await service.recordFailure();
      await service.recordFailure();
      expect(await service.getState()).toBe(CircuitBreakerState.OPEN);

      vi.advanceTimersByTime(30_000);
      expect(await service.getState()).toBe(CircuitBreakerState.HALF_OPEN);
    });

    it('closes on a successful probe in HALF_OPEN state', async () => {
      await service.recordFailure();
      await service.recordFailure();
      vi.advanceTimersByTime(30_000);
      expect(await service.getState()).toBe(CircuitBreakerState.HALF_OPEN);

      await service.recordSuccess();
      expect(await service.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(await service.isOpen()).toBe(false);
    });

    it('re-opens on a failed probe in HALF_OPEN state', async () => {
      await service.recordFailure();
      await service.recordFailure();
      vi.advanceTimersByTime(30_000);
      expect(await service.getState()).toBe(CircuitBreakerState.HALF_OPEN);

      await service.recordFailure();
      expect(await service.getState()).toBe(CircuitBreakerState.OPEN);
    });
  });

  describe('EC-01: success on first retry resets failure count', () => {
    it('resets on success in CLOSED state', async () => {
      await service.recordFailure();
      await service.recordSuccess();
      // After reset, two more failures needed to open
      await service.recordFailure();
      expect(await service.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('EC-04: state is shared across service instances via Redis', () => {
    it('a second instance connected to the same Redis sees the OPEN state', async () => {
      await service.recordFailure();
      await service.recordFailure();
      expect(await service.isOpen()).toBe(true);

      const secondInstance = new CircuitBreakerService(mockRedis as unknown as RedisService);
      expect(await secondInstance.getState()).toBe(CircuitBreakerState.OPEN);
    });
  });
});
