'use strict';
// tier3-smt.js — SMT Divergence BTC/ETH en H1
// Detects: BTC makes new swing H/L but ETH doesn't (or vice versa)
// Returns: { pass, divergence, direction, confidence }

function swingPoints(candles, lookback = 5) {
  const len = candles.length;
  if (len < lookback * 2 + 1) return { highs: [], lows: [] };

  const highs = [], lows = [];
  for (let i = lookback; i < len - lookback; i++) {
    const slice = candles.slice(i - lookback, i + lookback + 1);
    const maxH  = Math.max(...slice.map(c => c.h));
    const minL  = Math.min(...slice.map(c => c.l));
    if (candles[i].h === maxH) highs.push({ idx: i, price: candles[i].h, t: candles[i].t });
    if (candles[i].l === minL) lows.push({ idx: i, price: candles[i].l, t: candles[i].t });
  }
  return { highs, lows };
}

function analyze(btcH1, ethH1) {
  if (!btcH1?.length || !ethH1?.length) return { pass: false, reason: 'no_data' };

  // Align by time (use last 30 candles)
  const window = 30;
  const btc = btcH1.slice(-window);
  const eth = ethH1.slice(-window);

  const btcSw = swingPoints(btc, 3);
  const ethSw = swingPoints(eth, 3);

  if (!btcSw.highs.length || !btcSw.lows.length) return { pass: false, reason: 'no_swings' };

  // Last 2 swing highs
  const btcH1_ = btcSw.highs.slice(-2);
  const btcL1_ = btcSw.lows.slice(-2);
  const ethH1_ = ethSw.highs.slice(-2);
  const ethL1_ = ethSw.lows.slice(-2);

  let divergence = false;
  let direction = null;

  // Bearish SMT: BTC higher high, ETH lower high → SHORT signal
  if (btcH1_.length >= 2 && ethH1_.length >= 2) {
    const btcHH = btcH1_[1].price > btcH1_[0].price;
    const ethLH = ethH1_[1].price < ethH1_[0].price;
    if (btcHH && ethLH) { divergence = true; direction = 'SHORT'; }
  }

  // Bullish SMT: BTC lower low, ETH higher low → LONG signal
  if (btcL1_.length >= 2 && ethL1_.length >= 2) {
    const btcLL = btcL1_[1].price < btcL1_[0].price;
    const ethHL = ethL1_[1].price > ethL1_[0].price;
    if (btcLL && ethHL) { divergence = true; direction = 'LONG'; }
  }

  // Confidence: how recent was the divergence?
  const lastBtcSwing = direction === 'SHORT'
    ? btcH1_[btcH1_.length - 1]
    : btcL1_[btcL1_.length - 1];
  const barsAgo = lastBtcSwing ? btc.length - 1 - lastBtcSwing.idx : 99;
  const confidence = barsAgo <= 5 ? 'HIGH' : barsAgo <= 10 ? 'MED' : 'LOW';

  const pass = divergence && confidence !== 'LOW';

  return {
    pass,
    divergence,
    direction,
    confidence,
    barsAgo,
    reason: !divergence ? 'no_divergence' : confidence === 'LOW' ? 'stale_divergence' : 'ok',
  };
}

module.exports = { analyze };
