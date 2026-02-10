// Polymarket types

export interface PolymarketEvent {
  id: string;
  slug: string;
  title: string;
  endDate: string;
  markets: PolymarketMarket[];
}

export interface PolymarketMarket {
  id: string;
  question: string;
  outcomePrices: string | string[];
  closed: boolean;
  bestBid: number;
  bestAsk: number;
  volume: number;
  liquidity: number;
}

export interface ParsedPolymarket {
  market: PolymarketMarket;
  strike: number;
  direction: "above" | "below";
  yesPrice: number;
  eventSlug: string;
  endDate: Date;
}

// Deribit types

export interface DeribitBookSummary {
  instrument_name: string;
  bid_price: number | null;
  ask_price: number | null;
  mark_price: number;
  mark_iv: number;
  open_interest: number;
  underlying_price: number;
  volume_usd: number;
}

export interface DeribitTicker {
  instrument_name: string;
  mark_iv: number;
  mark_price: number;
  index_price: number;
  greeks: {
    delta: number;
    gamma: number;
    vega: number;
    theta: number;
  };
}

export interface ParsedDeribit {
  instrument_name: string;
  dateStr: string;
  expiry: Date;
  strike: number;
  type: "C" | "P";
  mark_price: number;
  mark_iv: number;
  underlying_price: number;
  bid_price: number | null;
  ask_price: number | null;
}

// Matched pair

export interface ArbitrageRow {
  label: string;
  strike: number;
  direction: "above" | "below";
  polyProb: number;
  deribitProb: number;
  spread: number;
  deribitInstrument: string;
  deribitSource: "delta" | "black-scholes";
}
