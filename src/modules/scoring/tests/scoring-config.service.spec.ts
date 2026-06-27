import { describe, expect, it, vi } from 'vitest';

vi.mock('@config/scoring.config', () => ({
  scoringConfig: {
    autoThreshold: 0.95,
    unmatchedFloor: 0,
    policyFlagPenalty: 0.5,
    dealValueExceededPenalty: 0.8,
    autoSendCapMinor: undefined,
  },
}));

import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { ScoringConfigService } from '../scoring-config.service';

function makeConfig(values: Record<string, unknown>) {
  return {
    get: vi.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('ScoringConfigService', () => {
  it('returns the configured auto threshold (coerced from string)', () => {
    const service = new ScoringConfigService(makeConfig({ SCORE_AUTO_THRESHOLD: '0.9' }));

    expect(service.getAutoThreshold()).toBe(0.9);
  });

  it('returns the seeded default when the threshold is unset', () => {
    const service = new ScoringConfigService(makeConfig({}));

    expect(service.getAutoThreshold()).toBe(0.95);
  });

  it('treats an unset cap as no cap and a valid cap as a number', () => {
    expect(new ScoringConfigService(makeConfig({})).getAutoSendCapMinor()).toBeUndefined();
    expect(
      new ScoringConfigService(
        makeConfig({ SCORE_AUTO_SEND_CAP_MINOR: '5000' }),
      ).getAutoSendCapMinor(),
    ).toBe(5000);
  });

  it('reads the threshold at decision time so a change affects the next read (AC-02/EC-02)', () => {
    const config = makeConfig({ SCORE_AUTO_THRESHOLD: '0.95' });
    const service = new ScoringConfigService(config);

    expect(service.getAutoThreshold()).toBe(0.95);

    (config.get as ReturnType<typeof vi.fn>).mockReturnValue('0.9');
    expect(service.getAutoThreshold()).toBe(0.9);
  });

  it('rejects an out-of-range threshold and retains the last valid value (EC-01/SEC-01)', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const config = makeConfig({ SCORE_AUTO_THRESHOLD: '0.9' });
    const service = new ScoringConfigService(config);

    expect(service.getAutoThreshold()).toBe(0.9);

    (config.get as ReturnType<typeof vi.fn>).mockReturnValue('1.5');
    expect(service.getAutoThreshold()).toBe(0.9);
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });

  it('rejects a non-numeric threshold and retains the last valid value (EC-01/SEC-01)', () => {
    const config = makeConfig({ SCORE_AUTO_THRESHOLD: '0.8' });
    const service = new ScoringConfigService(config);

    expect(service.getAutoThreshold()).toBe(0.8);

    (config.get as ReturnType<typeof vi.fn>).mockReturnValue('abc');
    expect(service.getAutoThreshold()).toBe(0.8);
  });

  it('rejects a malformed cap and retains the last valid cap (EC-01/SEC-01)', () => {
    const config = makeConfig({ SCORE_AUTO_SEND_CAP_MINOR: '5000' });
    const service = new ScoringConfigService(config);

    expect(service.getAutoSendCapMinor()).toBe(5000);

    (config.get as ReturnType<typeof vi.fn>).mockReturnValue('-1');
    expect(service.getAutoSendCapMinor()).toBe(5000);
  });
});
