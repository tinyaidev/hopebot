import { REFRESH_INTERVAL_MS } from "./config.js";
import { fetchBookSummaries, fetchIndexPrice } from "./api/deribit.js";
import { fetchPolymarketEvents } from "./api/polymarket.js";
import { matchMarkets } from "./matching/matcher.js";
import { renderDashboard } from "./display/table.js";

let running = true;

process.on("SIGINT", () => {
  console.log("\nShutting down...");
  running = false;
  process.exit(0);
});

async function tick(): Promise<void> {
  try {
    // Parallel fetch: Polymarket + Deribit summaries + BTC price
    const [polyMarkets, deribitOptions, btcPrice] = await Promise.all([
      fetchPolymarketEvents(),
      fetchBookSummaries(),
      fetchIndexPrice(),
    ]);

    // Match and compute
    const rows = await matchMarkets(polyMarkets, deribitOptions, btcPrice);

    // Render
    renderDashboard(rows, btcPrice);
  } catch (err) {
    console.error("Error fetching data:", err instanceof Error ? err.message : err);
  }
}

async function main(): Promise<void> {
  console.log("Starting BTC Arb Dashboard...");

  while (running) {
    await tick();
    // Sleep
    await new Promise((resolve) => setTimeout(resolve, REFRESH_INTERVAL_MS));
  }
}

main();
