import chalk from "chalk";
import Table from "cli-table3";
import { SPREAD_THRESHOLD_GREEN, SPREAD_THRESHOLD_RED, REFRESH_INTERVAL_MS } from "../config.js";
import type { ArbitrageRow } from "../types.js";

function colorSpread(spread: number): string {
  const sign = spread >= 0 ? "+" : "";
  const text = `${sign}${spread.toFixed(1)}%`;
  if (spread > SPREAD_THRESHOLD_GREEN) return chalk.green(text);
  if (spread < SPREAD_THRESHOLD_RED) return chalk.red(text);
  return chalk.yellow(text);
}

function formatStrike(strike: number): string {
  return "$" + strike.toLocaleString("en-US");
}

function formatPct(pct: number): string {
  return pct.toFixed(1) + "%";
}

export function renderDashboard(rows: ArbitrageRow[], btcPrice: number): void {
  console.clear();

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const refreshSec = REFRESH_INTERVAL_MS / 1000;

  console.log(
    chalk.bold(
      `BTC Arb Dashboard | BTC: $${btcPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })} | ${now} | Refresh: ${refreshSec}s`,
    ),
  );
  console.log();

  const table = new Table({
    head: [
      chalk.bold("Market"),
      chalk.bold("Strike"),
      chalk.bold("Dir"),
      chalk.bold("Poly %"),
      chalk.bold("Drbt %"),
      chalk.bold("Spread"),
      chalk.bold("Deribit Instrument"),
    ],
    style: { head: [], border: [] },
    colAligns: ["left", "right", "left", "right", "right", "right", "left"],
  });

  for (const row of rows) {
    table.push([
      row.label,
      formatStrike(row.strike),
      row.direction,
      formatPct(row.polyProb),
      formatPct(row.deribitProb),
      colorSpread(row.spread),
      chalk.dim(row.deribitInstrument),
    ]);
  }

  console.log(table.toString());
  console.log();
  console.log(
    chalk.dim("Spread = Poly - Deribit. Poly resolves on touch; Deribit at expiry."),
  );
  console.log(
    chalk.dim(
      `${chalk.green("Green")}: spread > ${SPREAD_THRESHOLD_GREEN}% | ${chalk.red("Red")}: spread < ${SPREAD_THRESHOLD_RED}% | ${chalk.yellow("Yellow")}: neutral`,
    ),
  );

  if (rows.length === 0) {
    console.log(chalk.yellow("\nNo matched markets found."));
  }
}
