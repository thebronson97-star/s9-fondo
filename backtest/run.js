'use strict';
// backtest/run.js — CLI entry: node backtest/run.js [--days=730] [--equity=10000] [--mc=1000]
require('dotenv').config();
const fs       = require('fs');
const path     = require('path');
const engine   = require('./engine');
const reporter = require('./reporter');

// CLI args: --key=value
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? 'true']; }),
);

const days   = parseInt(args.days   ?? '730');
const equity = parseFloat(args.equity ?? '10000');
const mcIter = parseInt(args.mc     ?? '1000');

let config = {};
try {
  config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 's9-rules.json'), 'utf8'));
} catch {
  console.warn('[RUN] config/s9-rules.json no encontrado — usando defaults');
}

(async () => {
  const start = Date.now();

  const { trades, equityStart, equityFinal } = await engine.run({ days, equity, config });

  const m  = reporter.metrics(trades);
  const mc = trades.length >= 5 ? reporter.monteCarlo(trades, mcIter) : null;

  reporter.printReport(trades, mc);

  if (m) {
    reporter.saveResults(trades, m, mc);
    console.log(`[RUN] Equity final: $${equityStart} → $${equityFinal}`);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[RUN] Tiempo total: ${elapsed}s`);
})().catch(e => {
  console.error('[RUN] Error fatal:', e.message);
  process.exit(1);
});
