import { DERIBIT_API } from "../config.js";
import type { DeribitBookSummary, DeribitTicker, ParsedDeribit } from "../types.js";

const MONTH_MAP: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

export function parseInstrumentName(name: string): { dateStr: string; strike: number; type: "C" | "P" } | null {
  // BTC-27FEB26-100000-C
  const match = name.match(/^BTC-(\d{1,2}[A-Z]{3}\d{2})-(\d+)-([CP])$/);
  if (!match) return null;
  return {
    dateStr: match[1],
    strike: parseInt(match[2], 10),
    type: match[3] as "C" | "P",
  };
}

export function parseDateStr(dateStr: string): Date {
  // 27FEB26 → 2026-02-27
  const match = dateStr.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/);
  if (!match) throw new Error(`Invalid date string: ${dateStr}`);
  const day = parseInt(match[1], 10);
  const month = MONTH_MAP[match[2]];
  const year = 2000 + parseInt(match[3], 10);
  // Deribit options expire at 08:00 UTC
  return new Date(Date.UTC(year, month, day, 8, 0, 0));
}

export async function fetchBookSummaries(): Promise<ParsedDeribit[]> {
  const url = `${DERIBIT_API}/get_book_summary_by_currency?currency=BTC&kind=option`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Deribit book summary: ${res.status}`);
  const json = await res.json() as { result: DeribitBookSummary[] };

  const parsed: ParsedDeribit[] = [];
  for (const item of json.result) {
    const inst = parseInstrumentName(item.instrument_name);
    if (!inst) continue;
    parsed.push({
      instrument_name: item.instrument_name,
      dateStr: inst.dateStr,
      expiry: parseDateStr(inst.dateStr),
      strike: inst.strike,
      type: inst.type,
      mark_price: item.mark_price,
      mark_iv: item.mark_iv,
      underlying_price: item.underlying_price,
      bid_price: item.bid_price,
      ask_price: item.ask_price,
    });
  }
  return parsed;
}

export async function fetchTicker(instrumentName: string): Promise<DeribitTicker> {
  const url = `${DERIBIT_API}/ticker?instrument_name=${encodeURIComponent(instrumentName)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Deribit ticker ${instrumentName}: ${res.status}`);
  const json = await res.json() as { result: DeribitTicker };
  return json.result;
}

export async function fetchIndexPrice(): Promise<number> {
  const url = `${DERIBIT_API}/get_index_price?index_name=btc_usd`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Deribit index price: ${res.status}`);
  const json = await res.json() as { result: { index_price: number } };
  return json.result.index_price;
}
