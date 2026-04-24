'use strict';
// signal.js — Orquestador de los 5 tiers
// Input: { btcData, ethData, equity, config }
// Output: { signal, side, symbol, tiers, trade, reason }

const t1 = require('./tier1-po3');
const t2 = require('./tier2-amt');
const t3 = require('./tier3-smt');
const t4 = require('./tier4-confirm');
const t5 = require('./tier5-risk');
const { detectRegime } = require('./regime');

function evaluate({ btcData, ethData, equity, config }) {
  const { daily: btcD, h4: btcH4, h1: btcH1, m3: btcM3 } = btcData;
  const { h1: ethH1 } = ethData;

  const result = {
    signal: false,
    side: null,
    symbol: null,
    tiers: {},
    trade: null,
    reason: null,
    ts: new Date().toISOString(),
  };

  // Pre-check: regime filter
  const regime = detectRegime(btcH1 ?? []);
  result.tiers.regime = regime;
  if (!regime.tradeable) {
    result.reason = `regime_not_tradeable (adx=${regime.adx?.toFixed(1)})`;
    return result;
  }

  // Tier 1: PO3 bias
  const tier1 = t1.analyze(btcD, btcH4);
  result.tiers.t1 = tier1;
  if (!tier1.pass) { result.reason = `t1_fail: ${tier1.reason}`; return result; }

  // Tier 2: AMT location
  const currentPrice = btcH1?.[btcH1.length - 1]?.c;
  const tier2 = t2.analyze(btcD, currentPrice, tier1.bias);
  result.tiers.t2 = tier2;
  if (!tier2.pass) { result.reason = `t2_fail: ${tier2.reason}`; return result; }

  // Tier 3: SMT divergence
  const tier3 = t3.analyze(btcH1, ethH1);
  result.tiers.t3 = tier3;
  if (!tier3.pass) { result.reason = `t3_fail: ${tier3.reason}`; return result; }

  // Direction consistency check
  if (tier3.direction && tier3.direction !== tier1.bias) {
    result.reason = `t3_direction_mismatch: smt=${tier3.direction} bias=${tier1.bias}`;
    return result;
  }

  // Tier 4: Confirmation (3m)
  const tier4 = t4.analyze(btcM3, tier1.bias);
  result.tiers.t4 = tier4;
  if (!tier4.pass) { result.reason = `t4_fail: ${tier4.reason}`; return result; }

  // Tier 5: Risk (R:R, size, SL/TP)
  const tier5 = t5.calculate({
    bias: tier1.bias,
    manipulation: tier1.manipulation,
    accumRange: tier1.accumRange,
    atrH4: tier1.atrH4,
    candles1h: btcH1,
    equity,
    config,
  });
  result.tiers.t5 = tier5;
  if (!tier5.pass) { result.reason = `t5_fail: ${tier5.reason}`; return result; }

  // All tiers passed
  result.signal = true;
  result.side   = tier1.bias;
  result.symbol = 'BTCUSDT';
  result.trade  = {
    symbol: 'BTCUSDT',
    side: tier1.bias,
    entry: tier5.entry,
    sl:    tier5.sl,
    tp:    tier5.tp,
    be:    tier5.be,
    size:  tier5.size,
    rr:    tier5.rr,
    riskUSD: tier5.riskUSD,
  };
  result.reason = 'all_tiers_pass';
  return result;
}

module.exports = { evaluate };
