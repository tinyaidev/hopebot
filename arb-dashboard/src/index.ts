import { fetchPolymarketBinaries } from './polymarket.js';
import { fetchDeribitOptions } from './deribit.js';
import { matchMarkets, analyzeArbitrage, enrichWithBookData } from './analysis.js';
import { generateChart } from './chart.js';
import type { ChartEntry } from './chart.js';
import type { ArbitrageOpportunity, Strategy } from './types.js';

async function main() {
  console.log('=== BTC Options Arbitrage: Polymarket vs Deribit ===\n');
  console.log('Target: $1-5K total across both legs | Deribit in 0.1 BTC chunks\n');
  console.log('⚠️  WARNING: Profits shown are BEFORE brokerage fees. Fees typically exceed any "TRUE ARB" profit found:');
  console.log('   • Polymarket: ~2% taker fee on CLOB  →  ~$58–60 on a $3K position');
  console.log('   • Deribit:    ~0.03% of underlying per leg  →  ~$58 for 2-leg spread on 1.5 BTC');
  console.log('   • Total fees: ~$116–120 per strategy  (wipes out all current TRUE ARB opportunities)\n');

  // 1. Fetch Polymarket binary options
  const polymarkets = await fetchPolymarketBinaries();

  if (polymarkets.length === 0) {
    console.log('\nNo BTC binary options found on Polymarket.');
    return;
  }

  // Compact summary
  console.log(`\nPolymarket BTC Binaries (${polymarkets.length} total):`);
  console.log('─'.repeat(90));
  console.log('  Strike     | YES     | Bid/Ask       | Type    | Expiration');
  console.log('─'.repeat(90));
  for (const pm of polymarkets) {
    const strike = `$${pm.strike.toLocaleString()}`.padEnd(10);
    const yes = `$${pm.yesPrice.toFixed(3)}`.padEnd(7);
    const bidAsk = `$${pm.yesBid.toFixed(3)}/$${pm.yesAsk.toFixed(3)}`.padEnd(13);
    const type = pm.marketType.padEnd(7);
    const exp = pm.expiration.toISOString().split('T')[0];
    console.log(`  ${strike} | ${yes} | ${bidAsk} | ${type} | ${exp}`);
  }

  // 2. Fetch Deribit options
  const targetStrikes = [...new Set(polymarkets.map(p => p.strike))];
  const targetExpirations = [...new Set(polymarkets.map(p => p.expiration.getTime()))].map(t => new Date(t));

  const { options: deribitOptions, indexPrice } = await fetchDeribitOptions(
    targetStrikes,
    targetExpirations,
  );

  if (deribitOptions.length === 0) {
    console.log('\nNo matching Deribit options found.');
    return;
  }

  console.log(`\nDeribit: ${deribitOptions.length} options fetched`);

  // 3. Match and analyze
  const pairs = matchMarkets(polymarkets, deribitOptions);
  if (pairs.length === 0) {
    console.log('\nNo matching pairs found.');
    return;
  }

  const allOpps: ArbitrageOpportunity[] = [];
  for (const pair of pairs) {
    const opp = analyzeArbitrage(pair, indexPrice);
    allOpps.push(opp);
  }

  allOpps.sort((a, b) => b.probabilityGap - a.probabilityGap);

  // 4. Print summary table
  console.log(`\n${allOpps.length} pairs analyzed. Top 20 by probability gap:`);
  console.log('─'.repeat(110));
  console.log('  Strike     | Expiry     | Poly    | Deribit | Gap    | Type    | Combos | Best Strategy');
  console.log('─'.repeat(110));

  for (const opp of allOpps.slice(0, 20)) {
    const pm = opp.pair.polymarket;
    const strike = `$${pm.strike.toLocaleString()}`.padEnd(10);
    const exp = opp.pair.expirationDate.toISOString().split('T')[0];
    const polyP = `${(opp.impliedProbPoly * 100).toFixed(1)}%`.padEnd(7);
    const deriP = `${(opp.impliedProbDeribit * 100).toFixed(1)}%`.padEnd(7);
    const gap = `${(opp.probabilityGap * 100).toFixed(1)}%`.padEnd(6);
    const type = pm.marketType.padEnd(7);
    const combos = `${opp.strategies.length}`.padEnd(6);
    const bestStrat = opp.strategies.length > 0 ? opp.strategies[0].name.slice(0, 40) : 'none';
    console.log(`  ${strike} | ${exp} | ${polyP} | ${deriP} | ${gap} | ${type} | ${combos} | ${bestStrat}`);
  }

  // 5. Collect top strategies and rank globally
  console.log('\n=== Top Arb Combos ($1-5K total, 0.1 BTC chunks) ===');

  const topStrategies: { opp: ArbitrageOpportunity; strategy: Strategy }[] = [];
  for (const opp of allOpps) {
    for (const s of opp.strategies.slice(0, 3)) {
      topStrategies.push({ opp, strategy: s });
    }
  }

  topStrategies.sort((a, b) => {
    const aMin = Math.min(...a.strategy.payoff.map(p => p.profitUSD));
    const bMin = Math.min(...b.strategy.payoff.map(p => p.profitUSD));
    if (aMin > 0 && bMin > 0) return bMin - aMin;
    if (aMin > 0) return -1;
    if (bMin > 0) return 1;
    const aMax = Math.max(...a.strategy.payoff.map(p => p.profitUSD));
    const bMax = Math.max(...b.strategy.payoff.map(p => p.profitUSD));
    return (bMax / Math.abs(bMin || 1)) - (aMax / Math.abs(aMin || 1));
  });

  const top = topStrategies.slice(0, 8);

  // Print terminal summary
  for (const { opp, strategy: s } of top) {
    const pm = opp.pair.polymarket;
    const minPL = Math.min(...s.payoff.map(p => p.profitUSD));
    const isArb = minPL > 0;

    console.log(`\n${'═'.repeat(90)}`);
    console.log(`${isArb ? '[TRUE ARB] ' : ''}${pm.title}`);
    console.log(`Strike: $${pm.strike.toLocaleString()} | Expiry: ${opp.pair.expirationDate.toISOString().split('T')[0]} | Gap: ${(opp.probabilityGap * 100).toFixed(1)}%`);
    console.log(`${'─'.repeat(90)}`);
    console.log(`  ${s.name}`);

    for (const leg of s.legs) {
      const dir = leg.direction === 'long' ? 'BUY' : 'SELL';
      const qty = leg.quantity < 1 ? leg.quantity.toFixed(1) : leg.quantity.toLocaleString();
      const price = leg.unitPrice < 1 ? `$${leg.unitPrice.toFixed(3)}` : `$${leg.unitPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
      const cost = leg.totalCost >= 0
        ? `$${leg.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : `-$${Math.abs(leg.totalCost).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
      console.log(`    ${dir} ${qty} × ${leg.instrument} @ ${price} = ${cost}`);
    }
    const totalCostStr = s.totalCost >= 0
      ? `$${s.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : `-$${Math.abs(s.totalCost).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    console.log(`    Net cost: ${totalCostStr} | Max profit: $${s.maxProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })} | Max loss: $${s.maxLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
    if (isArb) {
      console.log(`    ** Guaranteed min profit: $${minPL.toLocaleString(undefined, { maximumFractionDigits: 0 })} **`);
    }
    if (s.breakevens.length > 0) {
      console.log(`    Breakevens: ${s.breakevens.map(b => `$${b.toLocaleString()}`).join(', ')}`);
    }
  }

  // 6. Enrich top strategies with order book data (both Polymarket and Deribit)
  console.log('\n=== Fetching order book data for top strategies... ===');
  for (const { opp, strategy: s } of top) {
    try {
      await enrichWithBookData(s, opp.pair.polymarket, indexPrice);
      const polyNote = s.bookPolyVWAP
        ? `Poly VWAP=$${s.bookPolyVWAP.toFixed(3)} (mid=$${s.legs[0].unitPrice.toFixed(3)})`
        : 'no Poly book';
      const deribitNote = s.bookDeribitVWAP
        ? `Deribit VWAP=$${s.bookDeribitVWAP.toLocaleString(undefined, { maximumFractionDigits: 0 })} (mid=$${s.legs[1].unitPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}) fill=${s.bookDeribitFillPct?.toFixed(0)}%`
        : 'no Deribit book';
      console.log(`  ${s.name.slice(0, 50)}: ${polyNote} | ${deribitNote}`);
    } catch {
      console.log(`  ${s.name.slice(0, 50)}: book fetch failed`);
    }
  }

  // 6b. Print executability summary
  console.log('\n=== Executability (≤5% slippage, ≥90% fill) ===');
  for (const { strategy: s } of top) {
    const execTag = s.executable ? '[EXECUTABLE]' : '[SKIP]';
    const polySlip = s.polySlippagePct !== undefined
      ? `Poly slip: ${(s.polySlippagePct * 100).toFixed(1)}%`
      : 'Poly: n/a';
    const deribitSlip = s.deribitSlippagePct !== undefined
      ? `Deribit slip: ${(s.deribitSlippagePct * 100).toFixed(1)}%`
      : 'Deribit: n/a';
    const fillPct = s.bookDeribitFillPct !== undefined
      ? `fill: ${s.bookDeribitFillPct.toFixed(0)}%`
      : '';
    const bookCost = s.bookTotalCost !== undefined
      ? `book cost: $${s.bookTotalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : '';
    console.log(`  ${execTag} ${s.name.slice(0, 50)}`);
    console.log(`    ${polySlip} | ${deribitSlip} ${fillPct} | ${bookCost}`);
  }

  // 7. Generate chart
  const chartEntries: ChartEntry[] = top.map(({ opp, strategy }) => ({ opp, strategy }));
  console.log(`\n=== Generating Chart (${chartEntries.length} arb pairs) ===`);
  const chartPath = generateChart(chartEntries, indexPrice);

  if (chartPath) {
    const { default: open } = await import('open');
    console.log('Opening chart in browser...');
    await open(chartPath);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
