// Fixed locale so formatting is deterministic across environments (CI, browsers) and testable.
const LOCALE = 'en-US';

/**
 * Formats an integer minor-unit amount (e.g. 218500) as a currency string (e.g. "NGN 2,185.00").
 * Money is handled in minor units server-side; this is display-only. The minor-unit exponent is
 * taken from the currency itself (2 for NGN/USD, 0 for JPY, 3 for KWD) rather than assumed to be 2.
 */
export function formatMoney(minor: number, currency: string): string {
  try {
    const format = new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
    });
    const exponent = format.resolvedOptions().maximumFractionDigits ?? 2;
    // Intl separates the code and amount with a non-breaking space; normalize to a plain space.
    return format
      .format(minor / 10 ** exponent)
      .split(String.fromCharCode(160))
      .join(' ');
  } catch {
    // Unknown/invalid currency code: fall back to a plain 2-decimal number with the code prefix.
    return `${currency} ${(minor / 100).toLocaleString(LOCALE, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}
