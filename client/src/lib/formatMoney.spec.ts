import { describe, expect, it } from 'vitest';
import { formatMoney } from './formatMoney';

describe('formatMoney', () => {
  it('renders minor units as a grouped currency amount', () => {
    // 285000 minor = 2,850.00; the code form keeps the currency unambiguous across locales.
    expect(formatMoney(285000, 'NGN')).toMatch(/2,850\.00/);
    expect(formatMoney(285000, 'NGN')).toMatch(/NGN/);
  });

  it('always shows two decimal places', () => {
    expect(formatMoney(100, 'USD')).toMatch(/1\.00/);
    expect(formatMoney(0, 'USD')).toMatch(/0\.00/);
  });

  it('falls back gracefully for an invalid currency code', () => {
    // A malformed code makes Intl throw; the fallback keeps the amount readable with the code.
    expect(formatMoney(12345, 'INVALID')).toBe('INVALID 123.45');
  });
});
