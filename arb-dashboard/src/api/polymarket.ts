import { POLYMARKET_GAMMA_URL, POLYMARKET_SLUGS } from "../config.js";
import type { PolymarketEvent, ParsedPolymarket } from "../types.js";

const QUESTION_RE = /Will Bitcoin (reach|dip to) \$([0-9,]+)/i;

function parseOutcomePrices(raw: string | string[]): number[] {
  // Can be an actual array or a stringified JSON array
  if (typeof raw === "string") {
    try {
      return (JSON.parse(raw) as string[]).map(Number);
    } catch {
      return raw.split(",").map(Number);
    }
  }
  return raw.map(Number);
}

function parseStrike(str: string): number {
  return parseInt(str.replace(/,/g, ""), 10);
}

export async function fetchPolymarketEvents(): Promise<ParsedPolymarket[]> {
  const results: ParsedPolymarket[] = [];

  for (const slug of POLYMARKET_SLUGS) {
    const url = `${POLYMARKET_GAMMA_URL}?slug=${encodeURIComponent(slug)}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Polymarket ${slug}: ${res.status}`);
      continue;
    }
    const events = await res.json() as PolymarketEvent[];
    if (!events.length) continue;

    const event = events[0];
    const endDate = new Date(event.endDate);

    for (const market of event.markets) {
      if (market.closed) continue;

      const match = QUESTION_RE.exec(market.question);
      if (!match) continue;

      const direction = match[1].toLowerCase() === "reach" ? "above" : "below";
      const strike = parseStrike(match[2]);
      const prices = parseOutcomePrices(market.outcomePrices);
      const yesPrice = prices[0] ?? 0;

      results.push({
        market,
        strike,
        direction,
        yesPrice,
        eventSlug: slug,
        endDate,
      });
    }
  }

  return results;
}
