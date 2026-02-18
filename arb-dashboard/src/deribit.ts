import axios from 'axios';
import type { DeribitOption } from './types.js';

const DERIBIT_API = 'https://www.deribit.com/api/v2';

interface DeribitInstrument {
  instrument_name: string;
  strike: number;
  option_type: 'call' | 'put';
  expiration_timestamp: number;
  is_active: boolean;
}

interface DeribitTicker {
  best_bid_price: number | null;
  best_ask_price: number | null;
  mark_price: number;
  index_price: number;
  mark_iv: number;
  greeks: {
    delta: number;
  };
}

// Parse expiration date from instrument name like "BTC-28MAR25-100000-C"
function parseExpiration(instrumentName: string): Date {
  const parts = instrumentName.split('-');
  if (parts.length < 3) return new Date(0);

  const dateStr = parts[1]; // e.g. "28MAR25"
  const months: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };

  const dayMatch = dateStr.match(/^(\d+)([A-Z]+)(\d+)$/);
  if (!dayMatch) return new Date(0);

  const day = parseInt(dayMatch[1]);
  const month = months[dayMatch[2]];
  const year = 2000 + parseInt(dayMatch[3]);

  if (month === undefined) return new Date(0);

  // Deribit options expire at 08:00 UTC
  return new Date(Date.UTC(year, month, day, 8, 0, 0));
}

export async function fetchDeribitOptions(
  targetStrikes?: number[],
  targetExpirations?: Date[],
): Promise<{ options: DeribitOption[]; indexPrice: number }> {
  console.log('Fetching Deribit BTC options...');

  // Get all active BTC options
  const instrResp = await axios.get(`${DERIBIT_API}/public/get_instruments`, {
    params: {
      currency: 'BTC',
      kind: 'option',
      expired: false,
    },
    timeout: 15000,
  });

  const instruments: DeribitInstrument[] = instrResp.data.result;
  console.log(`  ${instruments.length} total active BTC options on Deribit`);

  // Get current BTC index price
  const indexResp = await axios.get(`${DERIBIT_API}/public/get_index_price`, {
    params: { index_name: 'btc_usd' },
    timeout: 10000,
  });
  const indexPrice: number = indexResp.data.result.index_price;
  console.log(`  BTC index price: $${indexPrice.toLocaleString()}`);

  // Filter instruments to relevant expirations
  let filtered = instruments.filter(i => i.is_active);

  if (targetExpirations && targetExpirations.length > 0) {
    // Match within 1 day tolerance (same-day expiry only)
    filtered = filtered.filter(i => {
      const exp = new Date(i.expiration_timestamp);
      return targetExpirations.some(te =>
        Math.abs(exp.getTime() - te.getTime()) < 24 * 60 * 60 * 1000
      );
    });
    console.log(`  ${filtered.length} options matching target expirations (±1 day)`);
  }

  // For strikes: if targets are provided, keep the closest options per expiration
  // Don't filter by strike range — instead fetch all at matching expiry and let
  // the analysis pick the best matches
  if (!targetExpirations) {
    // Default: limit to near-the-money options expiring within 90 days
    const now = Date.now();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    filtered = filtered.filter(i => {
      const exp = new Date(i.expiration_timestamp);
      const withinTime = exp.getTime() - now < ninetyDays && exp.getTime() > now;
      const nearMoney = Math.abs(i.strike - indexPrice) / indexPrice < 0.3;
      return withinTime && nearMoney;
    });
  }

  // If still too many, limit to the most relevant strikes
  // Group by expiration, then take N closest to each target strike
  if (targetStrikes && targetStrikes.length > 0 && filtered.length > 200) {
    const kept = new Set<string>();
    const strikesPerTarget = 10; // keep 10 closest strikes per target per expiry

    // Group by expiration
    const byExpiry = new Map<number, DeribitInstrument[]>();
    for (const i of filtered) {
      const key = i.expiration_timestamp;
      const group = byExpiry.get(key) || [];
      group.push(i);
      byExpiry.set(key, group);
    }

    for (const [, group] of byExpiry) {
      for (const ts of targetStrikes) {
        // Sort by distance to target strike
        const sorted = [...group].sort((a, b) =>
          Math.abs(a.strike - ts) - Math.abs(b.strike - ts)
        );
        for (const inst of sorted.slice(0, strikesPerTarget * 2)) { // *2 for call+put
          kept.add(inst.instrument_name);
        }
      }
      // Also keep ATM options
      const atm = [...group].sort((a, b) =>
        Math.abs(a.strike - indexPrice) - Math.abs(b.strike - indexPrice)
      );
      for (const inst of atm.slice(0, 10)) {
        kept.add(inst.instrument_name);
      }
    }

    filtered = filtered.filter(i => kept.has(i.instrument_name));
  }

  console.log(`  Fetching ticker data for ${filtered.length} filtered options...`);

  // Batch fetch ticker data (with rate limiting)
  const options: DeribitOption[] = [];
  const batchSize = 20;

  for (let i = 0; i < filtered.length; i += batchSize) {
    const batch = filtered.slice(i, i + batchSize);
    const tickerPromises = batch.map(async (instr) => {
      try {
        const resp = await axios.get(`${DERIBIT_API}/public/ticker`, {
          params: { instrument_name: instr.instrument_name },
          timeout: 10000,
        });
        const ticker: DeribitTicker = resp.data.result;

        const bidBTC = ticker.best_bid_price ?? 0;
        const askBTC = ticker.best_ask_price ?? bidBTC;
        const midBTC = (bidBTC + askBTC) / 2;

        return {
          instrumentName: instr.instrument_name,
          strike: instr.strike,
          type: instr.option_type,
          expiration: parseExpiration(instr.instrument_name),
          bidPrice: bidBTC * ticker.index_price,
          askPrice: askBTC * ticker.index_price,
          midPrice: midBTC * ticker.index_price,
          bidPriceBTC: bidBTC,
          askPriceBTC: askBTC,
          midPriceBTC: midBTC,
          indexPrice: ticker.index_price,
          markIV: ticker.mark_iv,
          delta: ticker.greeks.delta,
        } satisfies DeribitOption;
      } catch {
        return null;
      }
    });

    const results = await Promise.all(tickerPromises);
    for (const r of results) {
      if (r && r.midPrice > 0) options.push(r);
    }

    // Small delay between batches to avoid rate limits
    if (i + batchSize < filtered.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log(`  Got ticker data for ${options.length} options`);
  return { options, indexPrice };
}

// Fetch Deribit order book and compute VWAP for filling targetQtyBTC contracts
export async function fetchDeribitBookVWAP(
  instrumentName: string,
  targetQtyBTC: number,
  side: 'buy' | 'sell',
): Promise<{ vwapBTC: number; vwapUSD: number; filled: number; totalCostUSD: number; indexPrice: number }> {
  if (!instrumentName || targetQtyBTC <= 0) {
    return { vwapBTC: 0, vwapUSD: 0, filled: 0, totalCostUSD: 0, indexPrice: 0 };
  }

  try {
    const resp = await axios.get(`${DERIBIT_API}/public/get_order_book`, {
      params: { instrument_name: instrumentName, depth: 50 },
      timeout: 10000,
    });
    const result = resp.data.result;
    const idxPrice: number = result.index_price || result.underlying_price || 0;

    // Deribit book: bids/asks are [[price_btc, amount_btc], ...]
    // For buying: walk asks (lowest first)
    // For selling: walk bids (highest first)
    const levels: [number, number][] = side === 'buy'
      ? (result.asks || [])
      : (result.bids || []);

    let remaining = targetQtyBTC;
    let totalCostBTC = 0;
    let filled = 0;

    for (const [priceBTC, amountBTC] of levels) {
      const fill = Math.min(amountBTC, remaining);
      totalCostBTC += fill * priceBTC;
      filled += fill;
      remaining -= fill;
      if (remaining <= 0.001) break;
    }

    const vwapBTC = filled > 0 ? totalCostBTC / filled : 0;
    const vwapUSD = vwapBTC * idxPrice;
    const totalCostUSD = totalCostBTC * idxPrice;

    return { vwapBTC, vwapUSD, filled, totalCostUSD, indexPrice: idxPrice };
  } catch {
    return { vwapBTC: 0, vwapUSD: 0, filled: 0, totalCostUSD: 0, indexPrice: 0 };
  }
}

// Max fill within a slippage limit (marginal price stays within midPriceBTC * (1 ± slippage))
export async function fetchDeribitMaxFillAtSlippage(
  instrumentName: string,
  midPriceBTC: number,
  maxSlippagePct: number,
  side: 'buy' | 'sell',
): Promise<{ maxQtyBTC: number; totalCostUSD: number; vwapUSD: number; indexPrice: number }> {
  if (!instrumentName || midPriceBTC <= 0) {
    return { maxQtyBTC: 0, totalCostUSD: 0, vwapUSD: 0, indexPrice: 0 };
  }

  const priceLimit = side === 'buy'
    ? midPriceBTC * (1 + maxSlippagePct)
    : midPriceBTC * (1 - maxSlippagePct);

  try {
    const resp = await axios.get(`${DERIBIT_API}/public/get_order_book`, {
      params: { instrument_name: instrumentName, depth: 50 },
      timeout: 10000,
    });
    const result = resp.data.result;
    const idxPrice: number = result.index_price || result.underlying_price || 0;

    const levels: [number, number][] = side === 'buy'
      ? (result.asks || [])
      : (result.bids || []);

    let totalCostBTC = 0;
    let filled = 0;

    for (const [priceBTC, amountBTC] of levels) {
      if (side === 'buy' && priceBTC > priceLimit) break;
      if (side === 'sell' && priceBTC < priceLimit) break;
      totalCostBTC += amountBTC * priceBTC;
      filled += amountBTC;
    }

    const vwapBTC = filled > 0 ? totalCostBTC / filled : 0;
    return {
      maxQtyBTC: filled,
      totalCostUSD: totalCostBTC * idxPrice,
      vwapUSD: vwapBTC * idxPrice,
      indexPrice: idxPrice,
    };
  } catch {
    return { maxQtyBTC: 0, totalCostUSD: 0, vwapUSD: 0, indexPrice: 0 };
  }
}

// Group options by expiration date string
export function groupByExpiration(options: DeribitOption[]): Map<string, DeribitOption[]> {
  const groups = new Map<string, DeribitOption[]>();
  for (const opt of options) {
    const key = opt.expiration.toISOString().split('T')[0];
    const group = groups.get(key) || [];
    group.push(opt);
    groups.set(key, group);
  }
  return groups;
}
