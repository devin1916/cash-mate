/**
 * Currency-aware money formatting.
 * The active currency comes from the signed-in user's profile
 * (users.currency in the database) - never hard-code symbols.
 */
export const SUPPORTED_CURRENCIES = ['LKR', 'USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'JPY', 'AED', 'SGD'] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

let activeCurrency: string = 'LKR';

export function setCurrency(currency?: string | null): void {
  activeCurrency = currency && SUPPORTED_CURRENCIES.includes(currency as CurrencyCode) ? currency : 'LKR';
}

export function getCurrency(): string {
  return activeCurrency;
}

/** Format an amount in the given (or active) currency, e.g. "LKR 25,000.00". */
export const formatMoney = (amount: number, currency?: string): string => {
  const code = currency || activeCurrency;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
};

/** Compact format for large numbers, e.g. "LKR 1.5M". */
export const formatCompactMoney = (amount: number, currency?: string): string => {
  const code = currency || activeCurrency;
  if (Math.abs(amount) >= 1000000) return `${code} ${(amount / 1000000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1000) return `${code} ${(amount / 1000).toFixed(1)}K`;
  return formatMoney(amount, code);
};

// Backward-compatible helpers (LKR) kept so existing imports keep working.
export const formatLKR = (amount: number): string => formatMoney(amount, 'LKR');
export const formatCompactLKR = (amount: number): string => formatCompactMoney(amount, 'LKR');
