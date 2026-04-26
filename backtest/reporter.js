'use strict';
// backtest/reporter.js — Métricas, Monte Carlo, output CSV/JSON

const fs   = require('fs');
const path = require('path');

// ── Métricas base ────────────────────────────────────────────
function metrics(trades) {
  if (!trades.length) return null;

  const winners     = trades.filter(t => t.pnlR > 0);
  const losers      = trades.filter(t => t.pnlR <= 0);
  const grossProfit = winners.reduce((s, t) => s + t.pnlUSD, 0);
  const grossLoss   = Math.abs(losers.reduce((s, t) => s + t.pnlUSD, 0));
  const wr          = winners.length / trades.length;
  const pf          = grossLoss > 0 ? grossProfit / grossLoss : Infinity;
  const avgWinR     = winners.length ? winners.reduce((s, t) => s + t.pnlR, 0) / winners.length : 0;
  const avgLossR    = losers.length  ? Math.abs(losers.reduce((s, t) => s + t.pnlR, 0)) / losers.length : 0;
  const expectancy  = wr * avgWinR - (1 - wr) * avgLossR;

  // Max drawdown sobre curva de equity
  let peak  = trades[0].equityBefore;
  let maxDD = 0;
  for (const t of trades) {
    if (t.equityAfter > peak) peak = t.equityAfter;
    const dd = (peak - t.equityAfter) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  // Sharpe / Sortino diarios
  const byDay = {};
  for (const t of trades) {
    const day = new Date(t.exitTime).toISOString().slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + t.pnlUSD;
  }
  const dailyRets  = Object.values(byDay);
  const mean       = dailyRets.reduce((a, b) => a + b, 0) / (dailyRets.length || 1);
  const variance   = dailyRets.reduce((s, r) => s + (r - mean) ** 2, 0) / (dailyRets.length || 1);
  const std        = Math.sqrt(variance);
  const downRets   = dailyRets.filter(r => r < 0);
  const downStd    = downRets.length
    ? Math.sqrt(downRets.reduce((s, r) => s + r ** 2, 0) / downRets.length)
    : 0;
  const sharpe  = std > 0 ? +(mean / std * Math.sqrt(252)).toFixed(3) : 0;
  const sortino = downStd > 0 ? +(mean / downStd * Math.sqrt(252)).toFixed(3) : 0;

  const outcomes = { TP: 0, SL: 0, TIME: 0 };
  for (const t of trades) outcomes[t.outcome] = (outcomes[t.outcome] ?? 0) + 1;

  return {
    n:            trades.length,
    winners:      winners.length,
    losers:       losers.length,
    outcomes,
    winRate:      +wr.toFixed(4),
    profitFactor: pf === Infinity ? 999 : +pf.toFixed(3),
    expectancyR:  +expectancy.toFixed(3),
    avgWinR:      +avgWinR.toFixed(3),
    avgLossR:     +avgLossR.toFixed(3),
    maxDrawdown:  +maxDD.toFixed(4),
    sharpe,
    sortino,
    grossProfit:  +grossProfit.toFixed(2),
    grossLoss:    +grossLoss.toFixed(2),
    netPnL:       +(grossProfit - grossLoss).toFixed(2),
  };
}

// ── Monte Carlo bootstrap ─────────────────────────────────────
function monteCarlo(trades, iters = 1000) {
  if (trades.length < 5) return null;
  const pnls    = trades.map(t => t.pnlUSD);
  const startEq = trades[0].equityBefore;
  const results = [];

  for (let i = 0; i < iters; i++) {
    let eq = startEq, peak = eq, maxDD = 0;
    for (let j = 0; j < pnls.length; j++) {
      eq += pnls[Math.floor(Math.random() * pnls.length)];
      if (eq > peak) peak = eq;
      const dd = (peak - eq) / peak;
      if (dd > maxDD) maxDD = dd;
    }
    results.push({ netPnL: eq - startEq, maxDD, finalEq: eq });
  }

  results.sort((a, b) => a.netPnL - b.netPnL);
  const byDD = [...results].sort((a, b) => b.maxDD - a.maxDD);
  const p    = (arr, pct) => arr[Math.floor(arr.length * pct)];

  return {
    iters,
    pnlP05:          +p(results, 0.05).netPnL.toFixed(2),
    pnlP50:          +p(results, 0.50).netPnL.toFixed(2),
    pnlP95:          +p(results, 0.95).netPnL.toFixed(2),
    ddP50:           +p(byDD, 0.50).maxDD.toFixed(4),
    ddP95:           +p(byDD, 0.05).maxDD.toFixed(4),
    ruinProbability: +(results.filter(r => r.finalEq < startEq * 0.5).length / iters).toFixed(4),
  };
}

// ── Criterios innegociables ───────────────────────────────────
function verdict(m) {
  const checks = {
    winRate:      { val: m.winRate >= 0.40,    label: `WR ${(m.winRate*100).toFixed(1)}% >= 40%`       },
    profitFactor: { val: m.profitFactor >= 1.5, label: `PF ${m.profitFactor} >= 1.5`                   },
    maxDrawdown:  { val: m.maxDrawdown <= 0.10, label: `DD ${(m.maxDrawdown*100).toFixed(2)}% <= 10%`  },
    sharpe:       { val: m.sharpe >= 1.5,       label: `Sharpe ${m.sharpe} >= 1.5`                     },
    sample:       { val: m.n >= 30,             label: `N=${m.n} >= 30`                                },
  };
  const pass = Object.values(checks).every(c => c.val);
  return { pass, checks };
}

// ── Print ─────────────────────────────────────────────────────
function printReport(trades, mc) {
  const m = metrics(trades);
  if (!m) { console.log('[REPORTER] Sin trades para reportar'); return; }

  const v = verdict(m);
  console.log('\n══════════════════════════════════════════════');
  console.log('  BACKTEST REPORT — S9-TRIPLEX');
  console.log('══════════════════════════════════════════════');
  console.log(`  Trades       : ${m.n}  (TP:${m.outcomes.TP} / SL:${m.outcomes.SL} / TIME:${m.outcomes.TIME})`);
  console.log(`  Win Rate     : ${(m.winRate*100).toFixed(1)}%        ${m.winRate >= 0.40 ? 'PASS' : 'FAIL'} (min 40%)`);
  console.log(`  Profit Factor: ${m.profitFactor}        ${m.profitFactor >= 1.5 ? 'PASS' : 'FAIL'} (min 1.5)`);
  console.log(`  Expectancy   : ${m.expectancyR}R`);
  console.log(`  Avg Win/Loss : ${m.avgWinR}R / -${m.avgLossR}R`);
  console.log(`  Max Drawdown : ${(m.maxDrawdown*100).toFixed(2)}%       ${m.maxDrawdown <= 0.10 ? 'PASS' : 'FAIL'} (max 10%)`);
  console.log(`  Sharpe       : ${m.sharpe}        ${m.sharpe >= 1.5 ? 'PASS' : 'FAIL'} (min 1.5)`);
  console.log(`  Sortino      : ${m.sortino}        ${m.sortino >= 2.0 ? 'PASS' : 'FAIL'} (min 2.0)`);
  console.log(`  Net P&L      : $${m.netPnL}  (bruto: +$${m.grossProfit} / -$${m.grossLoss})`);
  console.log('──────────────────────────────────────────────');
  console.log(`  VEREDICTO    : ${v.pass ? '[ PASS ] Apto para paper trading' : '[ FAIL ] No cumple criterios'}`);
  console.log('──────────────────────────────────────────────');

  if (mc) {
    console.log('  MONTE CARLO (1000 iter bootstrap):');
    console.log(`  P&L P5/P50/P95 : $${mc.pnlP05} / $${mc.pnlP50} / $${mc.pnlP95}`);
    console.log(`  Max DD P50/P95 : ${(mc.ddP50*100).toFixed(2)}% / ${(mc.ddP95*100).toFixed(2)}%`);
    console.log(`  Prob. ruina    : ${(mc.ruinProbability*100).toFixed(1)}%  ${mc.ruinProbability < 0.05 ? 'PASS' : 'FAIL'} (max 5%)`);
  }
  console.log('══════════════════════════════════════════════\n');
  return m;
}

// ── Guardar resultados ────────────────────────────────────────
function saveResults(trades, m, mc) {
  const dir = path.join(__dirname, '..', 'state');
  fs.mkdirSync(dir, { recursive: true });
  const ts = Date.now();

  // Trades CSV
  const csvPath = path.join(dir, `backtest_trades_${ts}.csv`);
  const header  = 'entryTime,symbol,side,entry,sl,tp,rr,size,riskUSD,exit,exitTime,outcome,pnlPct,pnlR,pnlUSD,equityAfter\n';
  const rows    = trades.map(t => [
    new Date(t.entryTime).toISOString(), t.symbol, t.side,
    t.entry, t.sl, t.tp, t.rr, t.size, t.riskUSD,
    t.exit, new Date(t.exitTime).toISOString(),
    t.outcome, t.pnlPct, t.pnlR, t.pnlUSD, t.equityAfter,
  ].join(',')).join('\n');
  fs.writeFileSync(csvPath, header + rows);

  // Summary JSON
  const jsonPath = path.join(dir, `backtest_summary_${ts}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(
    { metrics: m, monteCarlo: mc, generatedAt: new Date().toISOString() }, null, 2,
  ));

  console.log(`[REPORTER] trades  → ${csvPath}`);
  console.log(`[REPORTER] summary → ${jsonPath}`);
  return { csvPath, jsonPath };
}

module.exports = { metrics, monteCarlo, verdict, printReport, saveResults };
