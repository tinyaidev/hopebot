// Polymarket binary option
export interface PolymarketBinary {
  marketId: string;
  conditionId: string;
  title: string;
  strike: number;
  direction: 'above' | 'below';
  marketType: 'binary' | 'barrier';
  expiration: Date;
  yesPrice: number;       // midpoint bid/ask, 0-1
  noPrice: number;        // midpoint bid/ask, 0-1
  yesBid: number;
  yesAsk: number;
  yesTokenId: string;     // CLOB token ID for YES outcome
  noTokenId: string;      // CLOB token ID for NO outcome
  eventSlug?: string;     // Polymarket event slug for URL construction
}

// Deribit option
export interface DeribitOption {
  instrumentName: string;
  strike: number;
  type: 'call' | 'put';
  expiration: Date;
  bidPrice: number;       // in USD
  askPrice: number;       // in USD
  midPrice: number;       // midpoint in USD
  bidPriceBTC: number;    // original BTC denomination
  askPriceBTC: number;
  midPriceBTC: number;
  indexPrice: number;     // current BTC price
  markIV: number;         // implied volatility
  delta: number;          // option delta
}

// Matched pair for comparison
export interface ArbitragePair {
  polymarket: PolymarketBinary;
  deribitOptions: DeribitOption[];  // calls and puts at nearby strikes
  bestCallMatch: DeribitOption | null;
  bestPutMatch: DeribitOption | null;
  expirationDate: Date;
}

// Payoff point for charting
export interface PayoffPoint {
  btcPrice: number;
  profitUSD: number;
}

// A leg of a concrete strategy
export interface StrategyLeg {
  instrument: string;     // e.g. "Poly YES above $70K" or "BTC-20FEB26-70000-P"
  direction: 'long' | 'short';
  quantity: number;       // number of contracts
  unitPrice: number;      // price per contract in USD
  totalCost: number;      // quantity × unitPrice (negative for short)
}

// A named strategy with its payoff curve in real USD
export interface Strategy {
  name: string;
  description: string;
  legs: StrategyLeg[];
  payoff: PayoffPoint[];          // combined P/L (mid price)
  legPayoffs: PayoffPoint[][];    // per-leg P/L curves (same indices as legs)
  totalCost: number;              // net entry cost in USD
  maxProfit: number;
  maxLoss: number;
  breakevens: number[];           // BTC prices where P/L crosses zero
  // Book-price data (filled in by enrichWithBookData)
  bookPolyVWAP?: number;              // Polymarket VWAP from CLOB order book
  bookPolyPayoff?: PayoffPoint[];     // poly leg P/L at book VWAP
  bookDeribitVWAP?: number;           // Deribit VWAP from order book (USD per BTC)
  bookDeribitFillPct?: number;        // % of target qty fillable on Deribit book
  bookDeribitPayoff?: PayoffPoint[];  // deribit leg P/L at book VWAP
  bookCombinedPayoff?: PayoffPoint[]; // combined P/L using both book VWAPs
  // Slippage analysis
  polySlippagePct?: number;           // poly VWAP slippage vs mid (%)
  deribitSlippagePct?: number;        // deribit VWAP slippage vs mid (%)
  executable?: boolean;               // both sides fill within slippage tolerance
  bookTotalCost?: number;             // total cost at book prices
}

// Arbitrage opportunity summary
export interface ArbitrageOpportunity {
  pair: ArbitragePair;
  strategies: Strategy[];
  impliedProbPoly: number;
  impliedProbDeribit: number;
  probabilityGap: number;
}
