import type {
  PolymarketBinary,
  DeribitOption,
  ArbitragePair,
  PayoffPoint,
  Strategy,
  StrategyLeg,
  ArbitrageOpportunity,
} from './types.js';
import { fetchBookVWAP } from './polymarket.js';
import { fetchDeribitBookVWAP } from './deribit.js';

// Position sizing: target $1-5K total across both legs
const TARGET_TOTAL_COST = 3000;   // aim for ~$3K total
const MIN_TOTAL_COST = 500;       // filter floor (allow some slack)
const MAX_TOTAL_COST = 8000;      // filter ceiling
const DERIBIT_MIN_QTY = 0.1;     // Deribit minimum contract size
const DERIBIT_MAX_QTY = 50;      // sanity cap
const MAX_SLIPPAGE_PCT = 0.05;   // 5% max slippage for "executable" flag

// ===== Price range: ±50% from current BTC price =====

function priceRange(currentPrice: number, numPoints = 300): number[] {
  const lo = currentPrice * 0.5;
  const hi = currentPrice * 1.5;
  const step = (hi - lo) / numPoints;
  const prices: number[] = [];
  for (let p = lo; p <= hi; p += step) {
    prices.push(Math.round(p));
  }
  return prices;
}

// ===== Atomic Position =====

type Bias = 'bull' | 'bear';

interface AtomicPosition {
  platform: 'polymarket' | 'deribit';
  name: string;
  instrument: string;
  bias: Bias;
  costPerUnit: number;    // entry cost per unit (negative = receive premium)
  maxPayout: number;      // max per-unit payout (Infinity for naked options)
  plPerUnit: (btcPrice: number) => number;
  isSpread: boolean;
}

// ===== Generate atomic positions =====

function generatePolyPositions(pm: PolymarketBinary): AtomicPosition[] {
  const K = pm.strike;
  const yesP = pm.yesPrice;
  const noP = pm.noPrice;
  const label = `$${(K / 1000).toFixed(0)}K`;
  const positions: AtomicPosition[] = [];

  if (pm.direction === 'above') {
    positions.push({
      platform: 'polymarket', name: `Long YES above ${label}`,
      instrument: `Poly YES above ${label}`, bias: 'bull',
      costPerUnit: yesP, maxPayout: 1, isSpread: false,
      plPerUnit: (s) => (s >= K ? 1 : 0) - yesP,
    });
    positions.push({
      platform: 'polymarket', name: `Short YES above ${label}`,
      instrument: `Poly YES above ${label}`, bias: 'bear',
      costPerUnit: -yesP, maxPayout: yesP, isSpread: false,
      plPerUnit: (s) => yesP - (s >= K ? 1 : 0),
    });
    positions.push({
      platform: 'polymarket', name: `Long NO above ${label}`,
      instrument: `Poly NO above ${label}`, bias: 'bear',
      costPerUnit: noP, maxPayout: 1, isSpread: false,
      plPerUnit: (s) => (s < K ? 1 : 0) - noP,
    });
    positions.push({
      platform: 'polymarket', name: `Short NO above ${label}`,
      instrument: `Poly NO above ${label}`, bias: 'bull',
      costPerUnit: -noP, maxPayout: noP, isSpread: false,
      plPerUnit: (s) => noP - (s < K ? 1 : 0),
    });
  } else {
    positions.push({
      platform: 'polymarket', name: `Long YES below ${label}`,
      instrument: `Poly YES below ${label}`, bias: 'bear',
      costPerUnit: yesP, maxPayout: 1, isSpread: false,
      plPerUnit: (s) => (s < K ? 1 : 0) - yesP,
    });
    positions.push({
      platform: 'polymarket', name: `Short YES below ${label}`,
      instrument: `Poly YES below ${label}`, bias: 'bull',
      costPerUnit: -yesP, maxPayout: yesP, isSpread: false,
      plPerUnit: (s) => yesP - (s < K ? 1 : 0),
    });
    positions.push({
      platform: 'polymarket', name: `Long NO below ${label}`,
      instrument: `Poly NO below ${label}`, bias: 'bull',
      costPerUnit: noP, maxPayout: 1, isSpread: false,
      plPerUnit: (s) => (s >= K ? 1 : 0) - noP,
    });
    positions.push({
      platform: 'polymarket', name: `Short NO below ${label}`,
      instrument: `Poly NO below ${label}`, bias: 'bear',
      costPerUnit: -noP, maxPayout: noP, isSpread: false,
      plPerUnit: (s) => noP - (s >= K ? 1 : 0),
    });
  }

  return positions;
}

function generateDeribitPositions(options: DeribitOption[]): AtomicPosition[] {
  const positions: AtomicPosition[] = [];

  for (const opt of options) {
    if (opt.type === 'call') {
      positions.push({
        platform: 'deribit', name: `Long Call @$${(opt.strike / 1000).toFixed(0)}K`,
        instrument: opt.instrumentName, bias: 'bull',
        costPerUnit: opt.midPrice, maxPayout: Infinity, isSpread: false,
        plPerUnit: (s) => Math.max(s - opt.strike, 0) - opt.midPrice,
      });
      positions.push({
        platform: 'deribit', name: `Short Call @$${(opt.strike / 1000).toFixed(0)}K`,
        instrument: opt.instrumentName, bias: 'bear',
        costPerUnit: -opt.midPrice, maxPayout: opt.midPrice, isSpread: false,
        plPerUnit: (s) => opt.midPrice - Math.max(s - opt.strike, 0),
      });
    } else {
      positions.push({
        platform: 'deribit', name: `Long Put @$${(opt.strike / 1000).toFixed(0)}K`,
        instrument: opt.instrumentName, bias: 'bear',
        costPerUnit: opt.midPrice, maxPayout: opt.strike, isSpread: false,
        plPerUnit: (s) => Math.max(opt.strike - s, 0) - opt.midPrice,
      });
      positions.push({
        platform: 'deribit', name: `Short Put @$${(opt.strike / 1000).toFixed(0)}K`,
        instrument: opt.instrumentName, bias: 'bull',
        costPerUnit: -opt.midPrice, maxPayout: opt.midPrice, isSpread: false,
        plPerUnit: (s) => opt.midPrice - Math.max(opt.strike - s, 0),
      });
    }
  }

  // Spreads: all pairs with reasonable width, using bid/ask for realistic entry
  // Only use options that have both a bid and an ask (liquid enough to trade both sides)
  const MIN_SPREAD_WIDTH = 2000;
  const MAX_SPREAD_WIDTH = 30000;
  const liquidOptions = options.filter(o => o.bidPrice > 0 && o.askPrice > 0);
  const calls = liquidOptions.filter(o => o.type === 'call').sort((a, b) => a.strike - b.strike);
  const puts = liquidOptions.filter(o => o.type === 'put').sort((a, b) => a.strike - b.strike);

  for (let i = 0; i < calls.length; i++) {
    for (let j = i + 1; j < calls.length; j++) {
      const lo = calls[i];
      const hi = calls[j];
      const width = hi.strike - lo.strike;
      if (width < MIN_SPREAD_WIDTH || width > MAX_SPREAD_WIDTH) continue;

      const kLo = (lo.strike / 1000).toFixed(0);
      const kHi = (hi.strike / 1000).toFixed(0);

      // Long call spread: buy lo call at ask, sell hi call at bid
      const longCost = lo.askPrice - hi.bidPrice;
      if (longCost > 0 && isFinite(longCost) && longCost < width) {
        positions.push({
          platform: 'deribit',
          name: `Long Call Spread ${kLo}K/${kHi}K`,
          instrument: `${lo.instrumentName} / ${hi.instrumentName}`,
          bias: 'bull', costPerUnit: longCost, maxPayout: width, isSpread: true,
          plPerUnit: (s) => Math.max(s - lo.strike, 0) - Math.max(s - hi.strike, 0) - longCost,
        });
      }

      // Short call spread: sell lo call at bid, buy hi call at ask
      const shortCredit = lo.bidPrice - hi.askPrice;
      if (shortCredit > 0 && isFinite(shortCredit) && shortCredit < width) {
        positions.push({
          platform: 'deribit',
          name: `Short Call Spread ${kLo}K/${kHi}K`,
          instrument: `${lo.instrumentName} / ${hi.instrumentName}`,
          bias: 'bear', costPerUnit: -shortCredit, maxPayout: shortCredit, isSpread: true,
          plPerUnit: (s) => shortCredit - (Math.max(s - lo.strike, 0) - Math.max(s - hi.strike, 0)),
        });
      }
    }
  }

  for (let i = 0; i < puts.length; i++) {
    for (let j = i + 1; j < puts.length; j++) {
      const lo = puts[i];
      const hi = puts[j];
      const width = hi.strike - lo.strike;
      if (width < MIN_SPREAD_WIDTH || width > MAX_SPREAD_WIDTH) continue;

      const kLo = (lo.strike / 1000).toFixed(0);
      const kHi = (hi.strike / 1000).toFixed(0);

      // Long put spread: buy hi put at ask, sell lo put at bid
      const longCost = hi.askPrice - lo.bidPrice;
      if (longCost > 0 && isFinite(longCost) && longCost < width) {
        positions.push({
          platform: 'deribit',
          name: `Long Put Spread ${kLo}K/${kHi}K`,
          instrument: `${hi.instrumentName} / ${lo.instrumentName}`,
          bias: 'bear', costPerUnit: longCost, maxPayout: width, isSpread: true,
          plPerUnit: (s) => Math.max(hi.strike - s, 0) - Math.max(lo.strike - s, 0) - longCost,
        });
      }

      // Short put spread: sell hi put at bid, buy lo put at ask
      const shortCredit = hi.bidPrice - lo.askPrice;
      if (shortCredit > 0 && isFinite(shortCredit) && shortCredit < width) {
        positions.push({
          platform: 'deribit',
          name: `Short Put Spread ${kLo}K/${kHi}K`,
          instrument: `${hi.instrumentName} / ${lo.instrumentName}`,
          bias: 'bull', costPerUnit: -shortCredit, maxPayout: shortCredit, isSpread: true,
          plPerUnit: (s) => shortCredit - (Math.max(hi.strike - s, 0) - Math.max(lo.strike - s, 0)),
        });
      }
    }
  }

  return positions;
}

// ===== Find valid arb combinations =====

interface ArbCombo {
  polyLeg: AtomicPosition;
  deribitLeg: AtomicPosition;
}

function findArbCombinations(
  polyPositions: AtomicPosition[],
  deribitPositions: AtomicPosition[],
): ArbCombo[] {
  const combos: ArbCombo[] = [];
  for (const poly of polyPositions) {
    for (const deribit of deribitPositions) {
      if (poly.bias === deribit.bias) continue;
      combos.push({ polyLeg: poly, deribitLeg: deribit });
    }
  }
  return combos;
}

// ===== Sizing =====
// Target $1-5K total cost across both legs.
// Solve for deribitQty (in 0.1 BTC steps) that hits ~$3K total.

function scaleCombo(
  combo: ArbCombo,
): { polyQty: number; deribitQty: number } {
  const { polyLeg, deribitLeg } = combo;

  const absDeribitCost = Math.abs(deribitLeg.costPerUnit);
  if (absDeribitCost <= 0) return { polyQty: 0, deribitQty: 0 };

  let polyPerDeribitBTC: number;

  if (deribitLeg.isSpread) {
    polyPerDeribitBTC = deribitLeg.maxPayout / polyLeg.maxPayout;
  } else {
    const absCost = Math.abs(polyLeg.costPerUnit);
    const denominator = polyLeg.costPerUnit >= 0
      ? (1 - absCost)  // long: potential gain per contract
      : absCost;        // short: premium received
    if (denominator <= 0.001) return { polyQty: 0, deribitQty: 0 };
    polyPerDeribitBTC = absDeribitCost / denominator;
  }

  // Total absolute cost per BTC of Deribit
  const costPerDeribitBTC = absDeribitCost + polyPerDeribitBTC * Math.abs(polyLeg.costPerUnit);
  if (costPerDeribitBTC <= 0) return { polyQty: 0, deribitQty: 0 };

  // Solve for deribitQty targeting $3K total, round to 0.1 BTC
  let deribitQty = Math.round(TARGET_TOTAL_COST / costPerDeribitBTC * 10) / 10;
  deribitQty = Math.max(DERIBIT_MIN_QTY, Math.min(DERIBIT_MAX_QTY, deribitQty));

  const polyQty = Math.floor(deribitQty * polyPerDeribitBTC);

  // Verify total is in acceptable range
  const totalAbsCost = deribitQty * absDeribitCost + polyQty * Math.abs(polyLeg.costPerUnit);
  if (totalAbsCost < MIN_TOTAL_COST || totalAbsCost > MAX_TOTAL_COST) {
    return { polyQty: 0, deribitQty: 0 };
  }

  return { polyQty, deribitQty };
}

// ===== Breakevens =====

function findBreakevens(payoff: PayoffPoint[]): number[] {
  const breakevens: number[] = [];
  for (let i = 1; i < payoff.length; i++) {
    const prev = payoff[i - 1];
    const curr = payoff[i];
    if ((prev.profitUSD <= 0 && curr.profitUSD > 0) ||
        (prev.profitUSD >= 0 && curr.profitUSD < 0)) {
      const frac = Math.abs(prev.profitUSD) / (Math.abs(prev.profitUSD) + Math.abs(curr.profitUSD));
      breakevens.push(Math.round(prev.btcPrice + frac * (curr.btcPrice - prev.btcPrice)));
    }
  }
  return breakevens;
}

// ===== Evaluate a combo =====

function evaluateCombo(
  combo: ArbCombo,
  prices: number[],
): Strategy {
  const { polyQty, deribitQty } = scaleCombo(combo);
  const { polyLeg, deribitLeg } = combo;

  const polyPayoff: PayoffPoint[] = [];
  const deribitPayoff: PayoffPoint[] = [];
  const payoff: PayoffPoint[] = [];

  for (const btcPrice of prices) {
    const polyPL = polyQty * polyLeg.plPerUnit(btcPrice);
    const deribitPL = deribitQty * deribitLeg.plPerUnit(btcPrice);
    polyPayoff.push({ btcPrice, profitUSD: polyPL });
    deribitPayoff.push({ btcPrice, profitUSD: deribitPL });
    payoff.push({ btcPrice, profitUSD: polyPL + deribitPL });
  }

  const profits = payoff.map(p => p.profitUSD);
  const maxProfit = Math.max(...profits);
  const maxLoss = Math.min(...profits);

  const polyCost = polyQty * polyLeg.costPerUnit;
  const deribitCost = deribitQty * deribitLeg.costPerUnit;

  const legs: StrategyLeg[] = [
    {
      instrument: polyLeg.instrument,
      direction: polyLeg.costPerUnit >= 0 ? 'long' : 'short',
      quantity: polyQty,
      unitPrice: Math.abs(polyLeg.costPerUnit),
      totalCost: polyCost,
    },
    {
      instrument: deribitLeg.instrument,
      direction: deribitLeg.costPerUnit >= 0 ? 'long' : 'short',
      quantity: deribitQty,
      unitPrice: Math.abs(deribitLeg.costPerUnit),
      totalCost: deribitCost,
    },
  ];

  return {
    name: `${polyLeg.name} + ${deribitLeg.name}`,
    description: `${polyLeg.name} (×${polyQty.toLocaleString()}) + ${deribitLeg.name} (×${deribitQty.toFixed(1)})`,
    legs,
    payoff,
    legPayoffs: [polyPayoff, deribitPayoff],
    totalCost: polyCost + deribitCost,
    maxProfit,
    maxLoss,
    breakevens: findBreakevens(payoff),
  };
}

// ===== Score =====

function scoreStrategy(s: Strategy): number {
  const profits = s.payoff.map(p => p.profitUSD);
  const minPL = Math.min(...profits);
  const maxPL = Math.max(...profits);

  if (minPL > 0) return 1_000_000 + minPL;

  const positiveCount = profits.filter(p => p > 0).length;
  const positiveRatio = positiveCount / profits.length;
  const lossRatio = minPL < 0 ? maxPL / Math.abs(minPL) : Infinity;
  return positiveRatio * 100 + Math.min(lossRatio, 100);
}

// ===== Match markets =====

export function matchMarkets(
  polymarkets: PolymarketBinary[],
  deribitOptions: DeribitOption[],
): ArbitragePair[] {
  const pairs: ArbitragePair[] = [];

  const deribitByExpiry = new Map<string, DeribitOption[]>();
  for (const opt of deribitOptions) {
    const key = opt.expiration.toISOString().split('T')[0];
    const group = deribitByExpiry.get(key) || [];
    group.push(opt);
    deribitByExpiry.set(key, group);
  }

  for (const pm of polymarkets) {
    let bestExpiry = '';
    let bestExpiryDiff = Infinity;
    for (const [key, group] of deribitByExpiry) {
      const diff = Math.abs(group[0].expiration.getTime() - pm.expiration.getTime());
      if (diff < bestExpiryDiff) {
        bestExpiryDiff = diff;
        bestExpiry = key;
      }
    }

    if (bestExpiryDiff > 24 * 60 * 60 * 1000) continue; // same-day expiry only

    const matchingOptions = deribitByExpiry.get(bestExpiry) || [];
    if (matchingOptions.length === 0) continue;

    const calls = matchingOptions.filter(d => d.type === 'call');
    const puts = matchingOptions.filter(d => d.type === 'put');

    const bestCall = calls.length > 0
      ? calls.reduce((best, c) =>
          Math.abs(c.strike - pm.strike) < Math.abs(best.strike - pm.strike) ? c : best)
      : null;

    const bestPut = puts.length > 0
      ? puts.reduce((best, p) =>
          Math.abs(p.strike - pm.strike) < Math.abs(best.strike - pm.strike) ? p : best)
      : null;

    const nearbyOptions = matchingOptions.filter(d =>
      Math.abs(d.strike - pm.strike) / pm.strike < 0.15
    );

    pairs.push({
      polymarket: pm,
      deribitOptions: nearbyOptions,
      bestCallMatch: bestCall,
      bestPutMatch: bestPut,
      expirationDate: pm.expiration,
    });
  }

  return pairs;
}

// ===== Main analysis =====

export function analyzeArbitrage(
  pair: ArbitragePair,
  indexPrice: number,
): ArbitrageOpportunity {
  const pm = pair.polymarket;
  const prices = priceRange(indexPrice);

  const polyPositions = generatePolyPositions(pm);
  const deribitPositions = generateDeribitPositions(pair.deribitOptions);
  const combos = findArbCombinations(polyPositions, deribitPositions);

  const strategies: Strategy[] = [];
  for (const combo of combos) {
    const { polyQty, deribitQty } = scaleCombo(combo);
    if (polyQty <= 0 || deribitQty <= 0 || !isFinite(deribitQty)) continue;

    const strategy = evaluateCombo(combo, prices);
    if (strategy.maxLoss < -MAX_TOTAL_COST * 2) continue; // filter absurd losses

    strategies.push(strategy);
  }

  strategies.sort((a, b) => scoreStrategy(b) - scoreStrategy(a));

  const impliedProbPoly = pm.direction === 'above' ? pm.yesPrice : (1 - pm.yesPrice);
  const impliedProbDeribit = pair.bestCallMatch
    ? Math.abs(pair.bestCallMatch.delta)
    : 0.5;

  return {
    pair,
    strategies,
    impliedProbPoly,
    impliedProbDeribit,
    probabilityGap: Math.abs(impliedProbPoly - impliedProbDeribit),
  };
}

// ===== Enrich strategy with order book data =====

export async function enrichWithBookData(
  strategy: Strategy,
  pm: PolymarketBinary,
  indexPrice: number,
): Promise<void> {
  let polySlippage = 0;
  let deribitSlippage = 0;

  // --- Polymarket order book ---
  const polyLeg = strategy.legs[0];
  const isYes = polyLeg.instrument.includes('YES');
  const polyBuying = polyLeg.direction === 'long';
  const tokenId = isYes ? pm.yesTokenId : pm.noTokenId;

  if (tokenId && polyLeg.quantity > 0) {
    const polySide: 'buy' | 'sell' = polyBuying ? 'buy' : 'sell';
    const { vwap, filled } = await fetchBookVWAP(tokenId, polyLeg.quantity, polySide);

    if (filled > 0 && vwap > 0) {
      strategy.bookPolyVWAP = vwap;
      const midPrice = polyLeg.unitPrice;
      const slipPerUnit = polyBuying ? (vwap - midPrice) : (midPrice - vwap);
      polySlippage = polyLeg.quantity * slipPerUnit;
      strategy.polySlippagePct = midPrice > 0 ? Math.abs(slipPerUnit / midPrice) : 0;

      strategy.bookPolyPayoff = strategy.legPayoffs[0].map(p => ({
        btcPrice: p.btcPrice,
        profitUSD: p.profitUSD - polySlippage,
      }));
    }
  }

  // --- Deribit order book ---
  const deribitLeg = strategy.legs[1];
  const deribitQty = deribitLeg.quantity;
  const deribitBuying = deribitLeg.direction === 'long';
  const instruments = deribitLeg.instrument.split(' / ').map(s => s.trim());

  if (instruments.length === 1) {
    const deribitSide: 'buy' | 'sell' = deribitBuying ? 'buy' : 'sell';
    const { vwapUSD, filled } = await fetchDeribitBookVWAP(instruments[0], deribitQty, deribitSide);

    if (filled > 0 && vwapUSD > 0) {
      strategy.bookDeribitVWAP = vwapUSD;
      strategy.bookDeribitFillPct = (filled / deribitQty) * 100;

      const midPrice = deribitLeg.unitPrice;
      const slipPerBTC = deribitBuying ? (vwapUSD - midPrice) : (midPrice - vwapUSD);
      deribitSlippage = deribitQty * slipPerBTC;
      strategy.deribitSlippagePct = midPrice > 0 ? Math.abs(slipPerBTC / midPrice) : 0;

      strategy.bookDeribitPayoff = strategy.legPayoffs[1].map(p => ({
        btcPrice: p.btcPrice,
        profitUSD: p.profitUSD - deribitSlippage,
      }));
    }
  } else if (instruments.length === 2) {
    const [instA, instB] = instruments;

    const bookA = deribitBuying
      ? await fetchDeribitBookVWAP(instA, deribitQty, 'buy')
      : await fetchDeribitBookVWAP(instA, deribitQty, 'sell');
    const bookB = deribitBuying
      ? await fetchDeribitBookVWAP(instB, deribitQty, 'sell')
      : await fetchDeribitBookVWAP(instB, deribitQty, 'buy');

    const fillPct = Math.min(
      bookA.filled > 0 ? (bookA.filled / deribitQty) * 100 : 0,
      bookB.filled > 0 ? (bookB.filled / deribitQty) * 100 : 0,
    );

    if (fillPct > 0) {
      const bookSpreadCost = deribitBuying
        ? bookA.vwapUSD - bookB.vwapUSD
        : bookB.vwapUSD - bookA.vwapUSD;

      strategy.bookDeribitVWAP = Math.abs(bookSpreadCost);
      strategy.bookDeribitFillPct = fillPct;

      const midPrice = deribitLeg.unitPrice;
      const slipPerBTC = deribitBuying
        ? (bookSpreadCost - midPrice)
        : (midPrice - bookSpreadCost);
      deribitSlippage = deribitQty * slipPerBTC;
      strategy.deribitSlippagePct = midPrice > 0 ? Math.abs(slipPerBTC / midPrice) : 0;

      strategy.bookDeribitPayoff = strategy.legPayoffs[1].map(p => ({
        btcPrice: p.btcPrice,
        profitUSD: p.profitUSD - deribitSlippage,
      }));
    }
  }

  // --- Combined book P/L ---
  const totalSlippage = polySlippage + deribitSlippage;
  if (totalSlippage !== 0) {
    strategy.bookCombinedPayoff = strategy.payoff.map(p => ({
      btcPrice: p.btcPrice,
      profitUSD: p.profitUSD - totalSlippage,
    }));
  }

  // --- Book total cost ---
  const polyBookCost = strategy.bookPolyVWAP
    ? polyLeg.quantity * strategy.bookPolyVWAP
    : polyLeg.quantity * polyLeg.unitPrice;
  const deribitBookCost = strategy.bookDeribitVWAP
    ? deribitQty * strategy.bookDeribitVWAP
    : deribitQty * deribitLeg.unitPrice;
  strategy.bookTotalCost = polyBookCost + deribitBookCost;

  // --- Executable flag: both sides within slippage tolerance ---
  const polyOk = (strategy.polySlippagePct ?? 0) <= MAX_SLIPPAGE_PCT;
  const deribitOk = (strategy.deribitSlippagePct ?? 0) <= MAX_SLIPPAGE_PCT;
  const deribitFilled = (strategy.bookDeribitFillPct ?? 0) >= 90;
  strategy.executable = polyOk && deribitOk && deribitFilled;
}
