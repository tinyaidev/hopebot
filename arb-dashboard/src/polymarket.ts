import axios from 'axios';
import type { PolymarketBinary } from './types.js';

const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';

interface GammaEventMarket {
  id: string;
  conditionId: string;
  question: string;
  endDate: string;
  endDateIso: string;
  active: boolean;
  closed: boolean;
  outcomePrices: string;
  clobTokenIds: string;
  outcomes: string;
  bestBid: number;
  bestAsk: number;
  lastTradePrice: number;
  negRisk: boolean;
}

interface GammaEvent {
  id: string;
  title: string;
  slug: string;
  active: boolean;
  closed: boolean;
  markets: GammaEventMarket[];
}

interface CLOBOrderBook {
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
}

// Extract strike price from title like "Will the price of Bitcoin be above $70,000 on February 15?"
function extractStrike(title: string): number | null {
  // Match $150k, $100K, $95.5k style
  const kMatch = title.match(/\$([0-9]+(?:\.[0-9]+)?)\s*[kK]/);
  if (kMatch) return parseFloat(kMatch[1]) * 1000;

  // Match $100,000 or $70,000 style
  const fullMatch = title.match(/\$([0-9]{1,3}(?:,?[0-9]{3})+)/);
  if (fullMatch) return parseFloat(fullMatch[1].replace(/,/g, ''));

  // Match $1m, $1M style
  const mMatch = title.match(/\$([0-9]+(?:\.[0-9]+)?)\s*[mM]/);
  if (mMatch) return parseFloat(mMatch[1]) * 1_000_000;

  return null;
}

// Determine direction and market type from title
function classifyMarket(title: string): {
  direction: 'above' | 'below';
  marketType: 'binary' | 'barrier';
} | null {
  const lower = title.toLowerCase();

  // European binary: "above", "over", "below", "under" (on a specific date)
  if (lower.includes('above') || lower.includes('over') || lower.includes('at or above')) {
    return { direction: 'above', marketType: 'binary' };
  }
  if (lower.includes('below') || lower.includes('under') || lower.includes('at or below')) {
    return { direction: 'below', marketType: 'binary' };
  }

  // Barrier/touch: "hit", "reach", "touch" (by a date)
  if (lower.includes('hit') || lower.includes('reach') || lower.includes('touch')) {
    return { direction: 'above', marketType: 'barrier' };
  }

  return null;
}

// Check if this is a BTC price market we care about
function isBTCPriceMarket(title: string): boolean {
  const lower = title.toLowerCase();
  if (!lower.includes('bitcoin') && !lower.includes('btc')) return false;
  if (!extractStrike(title)) return false;
  if (!classifyMarket(title)) return false;
  if (lower.includes('all-time')) return false;
  return true;
}

async function fetchOrderBook(tokenId: string): Promise<{ bid: number; ask: number }> {
  try {
    const resp = await axios.get<CLOBOrderBook>(`${CLOB_API}/book`, {
      params: { token_id: tokenId },
      timeout: 10000,
    });
    const book = resp.data;
    const bestBid = book.bids.length > 0
      ? Math.max(...book.bids.map(b => parseFloat(b.price)))
      : 0;
    const bestAsk = book.asks.length > 0
      ? Math.min(...book.asks.map(a => parseFloat(a.price)))
      : 1;
    return { bid: bestBid, ask: bestAsk };
  } catch {
    return { bid: 0, ask: 1 };
  }
}

// Generate date slug variants to search for "bitcoin above on {date}" events
function generateEventSlugs(): string[] {
  const slugs: string[] = [];
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];

  const now = new Date();
  // Look forward up to 90 days
  for (let d = 0; d < 90; d++) {
    const date = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
    const month = months[date.getMonth()];
    const day = date.getDate();
    slugs.push(`bitcoin-above-on-${month}-${day}`);
  }

  return [...new Set(slugs)]; // dedupe
}

async function fetchEventsForSlugs(slugs: string[]): Promise<GammaEvent[]> {
  const events: GammaEvent[] = [];
  const batchSize = 5;

  for (let i = 0; i < slugs.length; i += batchSize) {
    const batch = slugs.slice(i, i + batchSize);
    const promises = batch.map(async (slug) => {
      try {
        const resp = await axios.get<GammaEvent[]>(`${GAMMA_API}/events`, {
          params: { slug },
          timeout: 10000,
        });
        return resp.data;
      } catch {
        return [];
      }
    });
    const results = await Promise.all(promises);
    for (const eventList of results) {
      for (const event of eventList) {
        if (event.markets && event.markets.length > 0) {
          events.push(event);
        }
      }
    }
    // Small delay
    if (i + batchSize < slugs.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return events;
}

// Also search events API with pagination for any BTC markets
async function fetchBTCEventsFromSearch(): Promise<GammaEvent[]> {
  const events: GammaEvent[] = [];

  for (let offset = 0; offset < 500; offset += 100) {
    try {
      const resp = await axios.get<GammaEvent[]>(`${GAMMA_API}/events`, {
        params: { limit: 100, offset, active: true, closed: false },
        timeout: 15000,
      });
      for (const event of resp.data) {
        const title = event.title.toLowerCase();
        if (title.includes('bitcoin') || title.includes('btc')) {
          if (event.markets && event.markets.length > 0) {
            events.push(event);
          }
        }
      }
      if (resp.data.length < 100) break;
    } catch {
      break;
    }
  }

  return events;
}

function parseMarketFromEvent(market: GammaEventMarket, eventSlug?: string): PolymarketBinary | null {
  if (!isBTCPriceMarket(market.question)) return null;
  if (market.closed) return null;

  const endDate = market.endDateIso || market.endDate;
  if (!endDate) return null;

  const strike = extractStrike(market.question);
  const classification = classifyMarket(market.question);
  if (!strike || !classification) return null;

  const expiration = new Date(endDate);
  if (expiration < new Date()) return null;

  // Parse prices
  let yesPrice = 0.5;
  let noPrice = 0.5;
  try {
    const prices = JSON.parse(market.outcomePrices) as string[];
    yesPrice = parseFloat(prices[0]);
    noPrice = parseFloat(prices[1]);
  } catch {
    return null;
  }

  // Use bestBid/bestAsk if available from event API
  let yesBid = market.bestBid ?? yesPrice;
  let yesAsk = market.bestAsk ?? yesPrice;
  if (yesBid > 0 && yesAsk > 0) {
    yesPrice = (yesBid + yesAsk) / 2;
    noPrice = 1 - yesPrice;
  }

  // Filter out illiquid markets with wide bid/ask spreads
  const spread = yesAsk - yesBid;
  if (spread > 0.20) return null;

  // Parse CLOB token IDs
  let yesTokenId = '';
  let noTokenId = '';
  try {
    const tokenIds = JSON.parse(market.clobTokenIds) as string[];
    yesTokenId = tokenIds[0] || '';
    noTokenId = tokenIds[1] || '';
  } catch { /* ignore */ }

  return {
    marketId: String(market.id),
    conditionId: market.conditionId,
    title: market.question,
    strike,
    direction: classification.direction,
    marketType: classification.marketType,
    expiration,
    yesPrice,
    noPrice,
    yesBid,
    yesAsk,
    yesTokenId,
    noTokenId,
    eventSlug,
  };
}

export async function fetchPolymarketBinaries(): Promise<PolymarketBinary[]> {
  console.log('Fetching Polymarket BTC binary options...');

  const seen = new Set<string>();
  const results: PolymarketBinary[] = [];

  // Strategy 1: Search for "bitcoin above on {date}" events by slug pattern
  console.log('  Searching for "Bitcoin above" event markets...');
  const slugs = generateEventSlugs();
  const slugEvents = await fetchEventsForSlugs(slugs);
  console.log(`  Found ${slugEvents.length} "bitcoin above" events`);

  for (const event of slugEvents) {
    for (const market of event.markets) {
      const parsed = parseMarketFromEvent(market, event.slug);
      if (parsed && !seen.has(parsed.marketId)) {
        seen.add(parsed.marketId);
        results.push(parsed);
      }
    }
  }

  // Strategy 2: Search events API for any other BTC events
  console.log('  Searching general events for BTC markets...');
  const generalEvents = await fetchBTCEventsFromSearch();
  for (const event of generalEvents) {
    for (const market of event.markets) {
      const parsed = parseMarketFromEvent(market, event.slug);
      if (parsed && !seen.has(parsed.marketId)) {
        seen.add(parsed.marketId);
        results.push(parsed);
      }
    }
  }

  // Sort by expiration then strike
  results.sort((a, b) => {
    const expDiff = a.expiration.getTime() - b.expiration.getTime();
    if (expDiff !== 0) return expDiff;
    return a.strike - b.strike;
  });

  console.log(`  Found ${results.length} total BTC binary option(s) on Polymarket`);
  return results;
}

// Fetch full order book and compute VWAP for filling `quantity` contracts
export async function fetchBookVWAP(
  tokenId: string,
  quantity: number,
  side: 'buy' | 'sell',
): Promise<{ vwap: number; filled: number; totalCost: number }> {
  if (!tokenId || quantity <= 0) {
    return { vwap: 0, filled: 0, totalCost: 0 };
  }

  try {
    const resp = await axios.get<CLOBOrderBook>(`${CLOB_API}/book`, {
      params: { token_id: tokenId },
      timeout: 10000,
    });
    const book = resp.data;

    // For buying: walk asks (lowest price first)
    // For selling: walk bids (highest price first)
    const levels = side === 'buy'
      ? (book.asks || []).sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
      : (book.bids || []).sort((a, b) => parseFloat(b.price) - parseFloat(a.price));

    let remaining = quantity;
    let totalCost = 0;
    let filled = 0;

    for (const level of levels) {
      const price = parseFloat(level.price);
      const size = parseFloat(level.size);
      const fill = Math.min(size, remaining);
      totalCost += fill * price;
      filled += fill;
      remaining -= fill;
      if (remaining <= 0) break;
    }

    const vwap = filled > 0 ? totalCost / filled : 0;
    return { vwap, filled, totalCost };
  } catch {
    return { vwap: 0, filled: 0, totalCost: 0 };
  }
}

// Max fill within a slippage limit (marginal price stays within midPrice * (1 ± slippage))
export async function fetchPolyMaxFillAtSlippage(
  tokenId: string,
  midPrice: number,
  maxSlippagePct: number,  // e.g. 0.10 for 10%
  side: 'buy' | 'sell',
): Promise<{ maxQty: number; totalCost: number; vwap: number }> {
  if (!tokenId || midPrice <= 0) {
    return { maxQty: 0, totalCost: 0, vwap: 0 };
  }

  const priceLimit = side === 'buy'
    ? midPrice * (1 + maxSlippagePct)
    : midPrice * (1 - maxSlippagePct);

  try {
    const resp = await axios.get<CLOBOrderBook>(`${CLOB_API}/book`, {
      params: { token_id: tokenId },
      timeout: 10000,
    });
    const book = resp.data;

    const levels = side === 'buy'
      ? (book.asks || []).sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
      : (book.bids || []).sort((a, b) => parseFloat(b.price) - parseFloat(a.price));

    let totalCost = 0;
    let filled = 0;

    for (const level of levels) {
      const price = parseFloat(level.price);
      const size = parseFloat(level.size);
      // Stop if this level's price exceeds slippage limit
      if (side === 'buy' && price > priceLimit) break;
      if (side === 'sell' && price < priceLimit) break;
      totalCost += size * price;
      filled += size;
    }

    const vwap = filled > 0 ? totalCost / filled : 0;
    return { maxQty: filled, totalCost, vwap };
  } catch {
    return { maxQty: 0, totalCost: 0, vwap: 0 };
  }
}
