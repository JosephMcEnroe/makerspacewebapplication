export function currencyDigits(currency) {
  // Stripe represents legacy ISK/UGX amounts with two decimal places.
  return ["isk", "ugx"].includes(currency.toLowerCase()) ? 2
    : new Intl.NumberFormat("en-US", { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
}

export function currencyAmount(amount, currency) {
  return (amount ?? 0) / 10 ** currencyDigits(currency);
}
