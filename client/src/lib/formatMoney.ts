/**
 * Formats an integer minor-unit amount (e.g. 218500) as a currency string (e.g. "NGN 2,185.00").
 * Money is always handled in minor units server-side; this is display-only.
 */
export function formatMoney(minor: number, currency: string): string {
  const major = minor / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
    }).format(major);
  } catch {
    // Unknown/invalid currency code: fall back to a plain grouped number with the code prefix.
    return `${currency} ${major.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}
