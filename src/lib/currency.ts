/**
 * Global currency formatting utility.
 *
 * Default currency: USD ($)
 * Future-ready for: INR, EUR, GBP
 */

export type SupportedCurrency = "USD" | "INR" | "EUR" | "GBP";

export const DEFAULT_CURRENCY: SupportedCurrency = "USD";

const CURRENCY_CONFIG: Record<SupportedCurrency, { locale: string; symbol: string }> = {
  USD: { locale: "en-US", symbol: "$" },
  INR: { locale: "en-IN", symbol: "₹" },
  EUR: { locale: "de-DE", symbol: "€" },
  GBP: { locale: "en-GB", symbol: "£" },
};

/**
 * Format a number as currency.
 * @param amount  - numeric value
 * @param currency - ISO 4217 code (defaults to USD)
 * @param opts - Intl.NumberFormat options overrides
 */
export function fmtCurrency(
  amount: number | string | null | undefined,
  currency: SupportedCurrency = DEFAULT_CURRENCY,
  opts?: Partial<Intl.NumberFormatOptions>,
): string {
  const n = Number(amount ?? 0);
  const cfg = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.USD;
  return new Intl.NumberFormat(cfg.locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    ...opts,
  }).format(n);
}

/**
 * Quick dollar symbol prefix.
 * Example: fmtUSD(5000) => "$5,000"
 */
export function fmtUSD(amount: number | string | null | undefined): string {
  return fmtCurrency(amount, "USD");
}

/**
 * Format with 2 decimal places (for invoices, commissions).
 * Example: fmtUSDPrecise(125.5) => "$125.50"
 */
export function fmtUSDPrecise(amount: number | string | null | undefined): string {
  return fmtCurrency(amount, "USD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
