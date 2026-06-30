import { describe, expect, it } from 'vitest';
import { formatMoney } from './formatMoney';

// Output is deterministic because formatMoney pins the locale to en-US.
describe('formatMoney', () => {
  it('renders a 2-decimal currency (NGN) from minor units', () => {
    expect(formatMoney(285000, 'NGN')).toBe('NGN 2,850.00');
  });

  it('uses the currency exponent: JPY has 0 decimals, so minor units are whole yen', () => {
    expect(formatMoney(2850, 'JPY')).toBe('JPY 2,850');
  });

  it('falls back to a code-prefixed number for an invalid currency code', () => {
    expect(formatMoney(12345, 'INVALID')).toBe('INVALID 123.45');
  });
});
