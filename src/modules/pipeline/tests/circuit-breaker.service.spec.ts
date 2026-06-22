import { CircuitBreakerService, CircuitBreakerState } from '../circuit-breaker.service';

// Mock env with configurable values
vi.mock('@config/env', () => ({
  env: {
    CIRCUIT_BREAKER_WINDOW_S: 60,
    CIRCUIT_BREAKER_COOLDOWN_S: 30,
  },
}));

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(() => {
    service = new CircuitBreakerService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('starts CLOSED', () => {
      expect(service.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(service.isOpen()).toBe(false);
    });
  });

  describe('AC-03: opens after two consecutive failures within 60s', () => {
    it('stays CLOSED after one failure', () => {
      service.recordFailure();
      expect(service.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('opens after two consecutive failures within the window', () => {
      service.recordFailure();
      vi.advanceTimersByTime(10_000); // 10s later, within 60s window
      service.recordFailure();
      expect(service.getState()).toBe(CircuitBreakerState.OPEN);
      expect(service.isOpen()).toBe(true);
    });

    it('does NOT open if the second failure is outside the 60s window', () => {
      service.recordFailure();
      vi.advanceTimersByTime(61_000); // outside the window
      service.recordFailure();
      expect(service.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('AC-04: open breaker skips calls immediately', () => {
    it('isOpen() returns true when breaker is OPEN', () => {
      service.recordFailure();
      service.recordFailure();
      expect(service.isOpen()).toBe(true);
    });
  });

  describe('AC-05: half-opens after 30s cooldown, closes on success', () => {
    it('transitions to HALF_OPEN after cooldown', () => {
      service.recordFailure();
      service.recordFailure();
      expect(service.getState()).toBe(CircuitBreakerState.OPEN);

      vi.advanceTimersByTime(30_000);
      expect(service.getState()).toBe(CircuitBreakerState.HALF_OPEN);
    });

    it('closes on a successful probe in HALF_OPEN state', () => {
      service.recordFailure();
      service.recordFailure();
      vi.advanceTimersByTime(30_000);
      expect(service.getState()).toBe(CircuitBreakerState.HALF_OPEN);

      service.recordSuccess();
      expect(service.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(service.isOpen()).toBe(false);
    });

    it('re-opens on a failed probe in HALF_OPEN state', () => {
      service.recordFailure();
      service.recordFailure();
      vi.advanceTimersByTime(30_000);
      expect(service.getState()).toBe(CircuitBreakerState.HALF_OPEN);

      service.recordFailure();
      expect(service.getState()).toBe(CircuitBreakerState.OPEN);
    });
  });

  describe('EC-01: success on first retry resets failure count', () => {
    it('resets on success in CLOSED state', () => {
      service.recordFailure();
      service.recordSuccess();
      // After reset, two more failures needed to open
      service.recordFailure();
      expect(service.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('EC-04: in-memory state resets on new instance', () => {
    it('a new instance starts CLOSED regardless of prior instance state', () => {
      service.recordFailure();
      service.recordFailure();
      expect(service.isOpen()).toBe(true);

      const freshService = new CircuitBreakerService();
      expect(freshService.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });
});
