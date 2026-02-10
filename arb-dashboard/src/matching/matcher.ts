import { STRIKE_TOLERANCE, MAX_TICKER_FETCHES, TICKER_CONCURRENCY } from "../config.js";
import { fetchTicker } from "../api/deribit.js";
import { blackScholesProb, yearsToExpiry } from "./probability.js";
import type { ParsedPolymarket, ParsedDeribit, ArbitrageRow, DeribitTicker } from "../types.js";

function formatLabel(strike: number, direction: string, eventSlug: string): string {
  const k = strike >= 1000 ? `$${(strike / 1000).toFixed(0)}K` : `$${strike.toLocaleString()}`;
  const dir = direction === "above" ? "reach" : "dip";

  let period: string;
  if (eventSlug.includes("february-2026")) {
    period = "Feb '26";
  } else if (eventSlug.includes("before-2027")) {
    period = "Dec '26";
  } else {
    period = "???";
  }

  return `BTC ${k} ${dir} ${period}`;
}

/**
 * Find the best Deribit expiry that is closest to (but not after) the Polymarket end date.
 */
function findBestExpiry(polyEnd: Date, deribitOptions: ParsedDeribit[]): string | null {
  let bestDate: string | null = null;
  let bestDiff = Infinity;

  for (const opt of deribitOptions) {
    const diff = polyEnd.getTime() - opt.expiry.getTime();
    // Deribit expiry must be <= Polymarket end date
    if (diff >= 0 && diff < bestDiff) {
      bestDiff = diff;
      bestDate = opt.dateStr;
    }
  }

  return bestDate;
}

/**
 * Find the closest Deribit instrument to the target strike at the given expiry.
 */
function findClosestStrike(
  targetStrike: number,
  optionType: "C" | "P",
  expiryDateStr: string,
  deribitOptions: ParsedDeribit[],
): ParsedDeribit | null {
  let best: ParsedDeribit | null = null;
  let bestDiff = Infinity;

  for (const opt of deribitOptions) {
    if (opt.dateStr !== expiryDateStr) continue;
    if (opt.type !== optionType) continue;
    const diff = Math.abs(opt.strike - targetStrike);
    if (diff < bestDiff && diff <= STRIKE_TOLERANCE) {
      bestDiff = diff;
      best = opt;
    }
  }

  return best;
}

/**
 * Run batch of promises with limited concurrency.
 */
async function batchFetch<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<(T | null)[]> {
  const results: (T | null)[] = new Array(tasks.length).fill(null);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      try {
        results[i] = await tasks[i]();
      } catch {
        results[i] = null;
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function matchMarkets(
  polyMarkets: ParsedPolymarket[],
  deribitOptions: ParsedDeribit[],
  btcPrice: number,
): Promise<ArbitrageRow[]> {
  // Step 1: Find matches
  const matches: { poly: ParsedPolymarket; deribit: ParsedDeribit }[] = [];

  for (const poly of polyMarkets) {
    const optionType = poly.direction === "above" ? "C" : "P";
    const bestExpiry = findBestExpiry(poly.endDate, deribitOptions);
    if (!bestExpiry) continue;

    const match = findClosestStrike(poly.strike, optionType, bestExpiry, deribitOptions);
    if (!match) continue;

    matches.push({ poly, deribit: match });
  }

  // Step 2: Fetch tickers for top matches (limited)
  const toFetch = matches.slice(0, MAX_TICKER_FETCHES);
  const tickerTasks = toFetch.map(
    (m) => () => fetchTicker(m.deribit.instrument_name),
  );

  const tickers = await batchFetch(tickerTasks, TICKER_CONCURRENCY);

  // Step 3: Compute probabilities and spreads
  const rows: ArbitrageRow[] = [];

  for (let i = 0; i < toFetch.length; i++) {
    const { poly, deribit } = toFetch[i];
    const ticker = tickers[i] as DeribitTicker | null;

    let deribitProb: number;
    let source: "delta" | "black-scholes";

    if (ticker?.greeks?.delta != null) {
      // Delta proxy
      if (poly.direction === "above") {
        deribitProb = ticker.greeks.delta;
      } else {
        deribitProb = Math.abs(ticker.greeks.delta);
      }
      source = "delta";
    } else {
      // Black-Scholes fallback
      const iv = deribit.mark_iv / 100; // Deribit returns IV as percentage
      const T = yearsToExpiry(deribit.expiry);
      const probAbove = blackScholesProb(btcPrice, deribit.strike, iv, T);
      deribitProb = poly.direction === "above" ? probAbove : 1 - probAbove;
      source = "black-scholes";
    }

    const polyProb = poly.yesPrice;
    const spread = (polyProb - deribitProb) * 100; // As percentage points

    rows.push({
      label: formatLabel(poly.strike, poly.direction, poly.eventSlug),
      strike: deribit.strike,
      direction: poly.direction,
      polyProb: polyProb * 100,
      deribitProb: deribitProb * 100,
      spread,
      deribitInstrument: deribit.instrument_name,
      deribitSource: source,
    });
  }

  // Sort by absolute spread (largest first)
  rows.sort((a, b) => Math.abs(b.spread) - Math.abs(a.spread));

  return rows;
}
