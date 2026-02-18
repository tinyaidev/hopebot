import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { ArbitrageOpportunity, Strategy } from './types.js';

export interface ChartEntry {
  opp: ArbitrageOpportunity;
  strategy: Strategy;
}

function getPolymarketUrl(eventSlug?: string): string {
  if (eventSlug) return `https://polymarket.com/event/${eventSlug}`;
  return 'https://polymarket.com';
}

function getDeribitChainUrl(instrument: string): string {
  const firstInstr = instrument.split(' / ')[0].trim();
  const parts = firstInstr.split('-');
  if (parts.length >= 2) {
    return `https://www.deribit.com/options/BTC/${parts[0]}-${parts[1]}`;
  }
  return 'https://www.deribit.com/options/BTC';
}

export function generateChart(
  entries: ChartEntry[],
  indexPrice: number,
): string {
  if (entries.length === 0) {
    console.log('No strategies to chart.');
    return '';
  }

  const SIZING_LABEL = '$1-5K total';
  const chartSections: string[] = [];
  const plotScripts: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const { opp, strategy: s } = entries[i];
    const pm = opp.pair.polymarket;
    const chartId = `chart-${i}`;

    // ── Traces ──
    const traces: object[] = [];
    const hasPolyBook = !!s.bookPolyPayoff;
    const hasDeribitBook = !!s.bookDeribitPayoff;

    // 1. Poly leg P/L — mid (blue solid)
    if (s.legPayoffs.length >= 1) {
      traces.push({
        x: s.legPayoffs[0].map(p => p.btcPrice),
        y: s.legPayoffs[0].map(p => p.profitUSD),
        name: `${s.legs[0].instrument} (mid)`,
        type: 'scatter', mode: 'lines',
        line: { width: 2, color: '#636EFA' },
        hovertemplate: `BTC: $%{x:,.0f}<br>P/L: $%{y:,.0f}<extra>Poly (mid)</extra>`,
      });
    }

    // 2. Poly leg P/L — book (blue dashed)
    if (hasPolyBook && s.bookPolyPayoff) {
      traces.push({
        x: s.bookPolyPayoff.map(p => p.btcPrice),
        y: s.bookPolyPayoff.map(p => p.profitUSD),
        name: `${s.legs[0].instrument} (book)`,
        type: 'scatter', mode: 'lines',
        line: { width: 2, color: '#636EFA', dash: 'dash' },
        hovertemplate: `BTC: $%{x:,.0f}<br>P/L: $%{y:,.0f}<extra>Poly (book)</extra>`,
      });
    }

    // 3. Deribit leg P/L — mid (red solid)
    if (s.legPayoffs.length >= 2) {
      traces.push({
        x: s.legPayoffs[1].map(p => p.btcPrice),
        y: s.legPayoffs[1].map(p => p.profitUSD),
        name: `${s.legs[1].instrument} (mid)`,
        type: 'scatter', mode: 'lines',
        line: { width: 2, color: '#EF553B' },
        hovertemplate: `BTC: $%{x:,.0f}<br>P/L: $%{y:,.0f}<extra>Deribit (mid)</extra>`,
      });
    }

    // 4. Deribit leg P/L — book (red dashed)
    if (hasDeribitBook && s.bookDeribitPayoff) {
      traces.push({
        x: s.bookDeribitPayoff.map(p => p.btcPrice),
        y: s.bookDeribitPayoff.map(p => p.profitUSD),
        name: `${s.legs[1].instrument} (book)`,
        type: 'scatter', mode: 'lines',
        line: { width: 2, color: '#EF553B', dash: 'dash' },
        hovertemplate: `BTC: $%{x:,.0f}<br>P/L: $%{y:,.0f}<extra>Deribit (book)</extra>`,
      });
    }

    // 5. Combined P/L — mid (green solid)
    traces.push({
      x: s.payoff.map(p => p.btcPrice),
      y: s.payoff.map(p => p.profitUSD),
      name: 'Combined (mid)',
      type: 'scatter', mode: 'lines',
      line: { width: 3, color: '#00CC96' },
      hovertemplate: `BTC: $%{x:,.0f}<br>P/L: $%{y:,.0f}<extra>Combined (mid)</extra>`,
    });

    // 6. Combined P/L — book (green dashed)
    if (s.bookCombinedPayoff) {
      traces.push({
        x: s.bookCombinedPayoff.map(p => p.btcPrice),
        y: s.bookCombinedPayoff.map(p => p.profitUSD),
        name: 'Combined (book)',
        type: 'scatter', mode: 'lines',
        line: { width: 3, color: '#00CC96', dash: 'dash' },
        hovertemplate: `BTC: $%{x:,.0f}<br>P/L: $%{y:,.0f}<extra>Combined (book)</extra>`,
      });
    }

    // Zero line
    const xVals = s.payoff.map(p => p.btcPrice);
    traces.push({
      x: xVals, y: xVals.map(() => 0),
      name: 'Zero', type: 'scatter', mode: 'lines',
      line: { width: 1, dash: 'dash', color: '#888' },
      showlegend: false, hoverinfo: 'skip',
    });

    // ── Layout ──
    const expiryStr = opp.pair.expirationDate.toISOString().split('T')[0];
    const minPL = Math.min(...s.payoff.map(p => p.profitUSD));
    const arbTag = minPL > 0 ? ' [TRUE ARB]' : '';

    const layout = {
      xaxis: { title: 'BTC Price at Expiration', tickformat: '$,.0f' },
      yaxis: { title: 'P/L (USD)', tickformat: '$,.0f' },
      showlegend: true,
      legend: { orientation: 'h' as const, y: -0.18, x: 0.5, xanchor: 'center' as const },
      title: {
        text: `<b>${s.name}</b>${arbTag} — ${pm.title} (exp ${expiryStr})`,
        font: { size: 13 },
      },
      shapes: [
        {
          type: 'line', xref: 'x', yref: 'paper',
          x0: indexPrice, x1: indexPrice, y0: 0, y1: 1,
          line: { color: '#FFD700', width: 2, dash: 'dot' },
        },
        {
          type: 'line', xref: 'x', yref: 'paper',
          x0: pm.strike, x1: pm.strike, y0: 0, y1: 1,
          line: { color: '#FF4444', width: 2, dash: 'dash' },
        },
      ],
      margin: { t: 50, b: 80, l: 80, r: 40 },
      hovermode: 'x unified',
      height: 400,
    };

    // ── Detail HTML ──
    const arbLabel = minPL > 0
      ? ` <span style="color:green;font-weight:bold">[TRUE ARB — min: $${minPL.toLocaleString(undefined, { maximumFractionDigits: 0 })}]</span>`
      : '';

    const execBadge = s.executable
      ? '<span style="color:green;font-weight:bold">[EXECUTABLE]</span>'
      : '<span style="color:orange">[NOT EXECUTABLE]</span>';

    const slipNote = [
      s.polySlippagePct !== undefined ? `Poly slip: ${(s.polySlippagePct * 100).toFixed(1)}%` : '',
      s.deribitSlippagePct !== undefined ? `Deribit slip: ${(s.deribitSlippagePct * 100).toFixed(1)}%` : '',
      s.bookTotalCost !== undefined ? `Book cost: $${s.bookTotalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '',
    ].filter(Boolean).join(' | ');

    const legsHtml = s.legs.map((l, idx) => {
      const dir = l.direction === 'long' ? 'BUY' : 'SELL';
      const qty = l.quantity < 1 ? l.quantity.toFixed(4) : l.quantity.toLocaleString();
      const price = l.unitPrice < 1 ? `$${l.unitPrice.toFixed(3)}` : `$${l.unitPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
      const cost = l.totalCost >= 0
        ? `$${l.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : `-$${Math.abs(l.totalCost).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
      const color = idx === 0 ? '#636EFA' : '#EF553B';
      return `<tr>
        <td style="padding:4px 8px"><span style="color:${color}">&#9632;</span> ${dir}</td>
        <td style="padding:4px 8px">${qty}</td>
        <td style="padding:4px 8px">${l.instrument}</td>
        <td style="padding:4px 8px;text-align:right">${price}</td>
        <td style="padding:4px 8px;text-align:right">${cost}</td>
      </tr>`;
    }).join('\n');

    const totalCostStr = s.totalCost >= 0
      ? `$${s.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : `-$${Math.abs(s.totalCost).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    const bes = s.breakevens.length > 0
      ? s.breakevens.map(b => `$${b.toLocaleString()}`).join(', ')
      : 'none';

    const polyBookNote = s.bookPolyVWAP
      ? `<br>Poly Book VWAP: $${s.bookPolyVWAP.toFixed(3)} (mid: $${s.legs[0].unitPrice.toFixed(3)})`
      : '';
    const deribitBookNote = s.bookDeribitVWAP
      ? `<br>Deribit Book VWAP: $${s.bookDeribitVWAP.toLocaleString(undefined, { maximumFractionDigits: 0 })} (mid: $${s.legs[1].unitPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })})${s.bookDeribitFillPct !== undefined ? ` — ${s.bookDeribitFillPct.toFixed(0)}% fillable` : ''}`
      : '';
    const bookNote = polyBookNote + deribitBookNote;

    // Links
    const polyUrl = getPolymarketUrl(pm.eventSlug);
    const deribitUrl = getDeribitChainUrl(s.legs[1].instrument);

    const detailHtml = `
      <div style="padding:16px 20px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;background:white">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
          <div>
            <h3 style="margin:0 0 4px 0">${s.name}${arbLabel} ${execBadge}</h3>
            <p style="margin:0 0 8px 0;color:#666;font-size:13px">
              ${pm.title} | Strike: $${pm.strike.toLocaleString()} | Expiry: ${expiryStr} | ${SIZING_LABEL}${slipNote ? ` | ${slipNote}` : ''}
            </p>
          </div>
          <div style="display:flex;gap:12px;flex-shrink:0;padding-top:2px">
            <a href="${polyUrl}" target="_blank" rel="noopener"
               style="display:inline-block;padding:4px 12px;border-radius:4px;background:#636EFA;color:white;text-decoration:none;font-size:12px;font-weight:500">
              Polymarket &#8599;</a>
            <a href="${deribitUrl}" target="_blank" rel="noopener"
               style="display:inline-block;padding:4px 12px;border-radius:4px;background:#EF553B;color:white;text-decoration:none;font-size:12px;font-weight:500">
              Deribit Chain &#8599;</a>
          </div>
        </div>
        <table style="border-collapse:collapse;font-size:13px;margin-bottom:8px;width:100%">
          <thead><tr style="background:#f5f5f5">
            <th style="padding:4px 8px;text-align:left">Dir</th>
            <th style="padding:4px 8px;text-align:left">Qty</th>
            <th style="padding:4px 8px;text-align:left">Instrument</th>
            <th style="padding:4px 8px;text-align:right">Unit Price</th>
            <th style="padding:4px 8px;text-align:right">Cost</th>
          </tr></thead>
          <tbody>${legsHtml}</tbody>
        </table>
        <p style="margin:0;font-size:13px">
          Net cost: <b>${totalCostStr}</b> |
          Max profit: <b style="color:green">$${s.maxProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b> |
          Max loss: <b style="color:red">$${s.maxLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b> |
          Breakevens: ${bes}${bookNote}
        </p>
      </div>`;

    chartSections.push(`
      <div class="strategy-section">
        <div class="chart-container">
          <div id="${chartId}"></div>
        </div>
        ${detailHtml}
      </div>`);

    plotScripts.push(
      `Plotly.newPlot('${chartId}', ${JSON.stringify(traces)}, ${JSON.stringify(layout)}, plotConfig);`,
    );
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>BTC Options Arbitrage: Polymarket vs Deribit</title>
  <script src="https://cdn.plot.ly/plotly-2.35.0.min.js"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f0f0f0; }
    h1 { text-align: center; color: #333; }
    .chart-container {
      background: white; border-radius: 8px 8px 0 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 16px 16px 0 16px;
    }
    .strategy-section {
      max-width: 1400px; margin: 0 auto 28px auto;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08); border-radius: 8px;
    }
    .info { max-width: 1400px; margin: 0 auto; }
    .legend-note { color: #888; font-size: 12px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="info">
    <h1>BTC Options Arbitrage: P/L Dashboard</h1>
    <p style="text-align:center;color:#666">
      Polymarket vs Deribit | BTC: <strong>$${indexPrice.toLocaleString()}</strong> |
      Target: ${SIZING_LABEL} | ${new Date().toLocaleString()}
    </p>
  </div>

  ${chartSections.join('\n')}

  <div class="info">
    <p class="legend-note">
      <span style="color:#636EFA">&#9632;</span> Blue solid = Poly P/L (mid) |
      <span style="color:#636EFA">&#9632;</span> Blue dashed = Poly P/L (book VWAP) |
      <span style="color:#EF553B">&#9632;</span> Red solid = Deribit P/L (mid) |
      <span style="color:#EF553B">&#9632;</span> Red dashed = Deribit P/L (book VWAP) |
      <span style="color:#00CC96">&#9632;</span> Green solid = Combined (mid) |
      <span style="color:#00CC96">&#9632;</span> Green dashed = Combined (book)<br>
      Gold dotted = current BTC ($${indexPrice.toLocaleString()}) |
      Red dashed vertical = Polymarket strike<br>
      Sized to $1-5K total across both legs, Deribit in 0.1 BTC steps.
    </p>
  </div>

  <script>
    const plotConfig = {
      responsive: true,
      displayModeBar: true,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    };
    ${plotScripts.join('\n    ')}
  </script>
</body>
</html>`;

  const outPath = join(tmpdir(), 'arb-dashboard.html');
  writeFileSync(outPath, html);
  console.log(`Chart saved to: ${outPath}`);
  return outPath;
}
