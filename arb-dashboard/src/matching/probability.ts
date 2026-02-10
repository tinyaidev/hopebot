/**
 * Normal CDF approximation (Abramowitz & Stegun 26.2.17)
 */
export function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Black-Scholes implied probability that BTC > strike at expiry.
 * Uses risk-free rate = 0 for simplicity.
 *
 * @param spot - Current BTC price
 * @param strike - Strike price
 * @param iv - Implied volatility (annualized, as decimal e.g. 0.60 for 60%)
 * @param timeToExpiry - Time to expiry in years
 * @returns P(BTC > strike at expiry) = N(d2)
 */
export function blackScholesProb(
  spot: number,
  strike: number,
  iv: number,
  timeToExpiry: number,
): number {
  if (timeToExpiry <= 0) return spot > strike ? 1 : 0;
  if (iv <= 0) return spot > strike ? 1 : 0;

  const sqrtT = Math.sqrt(timeToExpiry);
  const d2 = (Math.log(spot / strike) - 0.5 * iv * iv * timeToExpiry) / (iv * sqrtT);
  return normalCDF(d2);
}

/**
 * Get years to expiry from now.
 */
export function yearsToExpiry(expiry: Date): number {
  const now = Date.now();
  const ms = expiry.getTime() - now;
  return ms / (365.25 * 24 * 60 * 60 * 1000);
}
