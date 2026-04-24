'use strict';
// tier4-confirm.js — FVG + rejection + aggression proxy (3m candles)
// Returns: { pass, fvg, rejection, aggression }

const { sma } = require('./indicators');

// Fair Value Gap: gap between candle[i-2].high and candle[i].low (bullish)
// or candle[i-2].low and candle[i].high (bearish)
function detectFVG(candles, bias) {
  if (candles.length < 3) return { detected: false };
  const fvgs = [];

  for (let i = 2; i < candles.length; i++) {
    const c0 = candles[i - 2], c2 = candles[i];
    if (bias === 'LONG'  && c2.l > c0.h) fvgs.push({ top: c2.l, bot: c0.h, idx: i, side: 'BULL' });
    if (bias === 'SHORT' && c2.h < c0.l) fvgs.push({ top: c0.l, bot: c2.h, idx: i, side: 'BEAR' });
  }

  if (!fvgs.length) return { detected: false };

  // Most recent FVG
  const latest = fvgs[fvgs.length - 1];
  const current = candles[candles.length - 1].c;

  // Check if price is reacting FROM the FVG (price entered and is rejecting)
  const fvgMid  = (latest.top + latest.bot) / 2;
  const inFVG   = current >= latest.bot && current <= latest.top;
  const aboveFVG = current > latest.top;
  const belowFVG = current < latest.bot;

  return {
    detected: fvgs.length > 0,
    latest,
    reacting: inFVG || (latest.side === 'BULL' ? aboveFVG : belowFVG),
    fvgMid,
  };
}

// Rejection candle: wick > 60% of total range in opposite direction of trade
function detectRejection(candles, bias) {
  if (!candles.length) return { detected: false };
  const last = candles[candles.length - 1];
  const range = last.h - last.l;
  if (range === 0) return { detected: false };

  const upperWick = last.h - Math.max(last.o, last.c);
  const lowerWick = Math.min(last.o, last.c) - last.l;

  const rejected = bias === 'LONG'
    ? lowerWick / range > 0.6  // long wick below = rejection of lows
    : upperWick / range > 0.6; // long wick above = rejection of highs

  return { detected: rejected, upperWick, lowerWick, range };
}

// Aggression proxy: volume > 1.3× SMA20
function detectAggression(candles) {
  if (candles.length < 20) return { detected: false };
  const vols  = candles.map(c => c.v);
  const vol20 = sma(vols, 20);
  const lastV = vols[vols.length - 1];
  return {
    detected: vol20 ? lastV > vol20 * 1.3 : false,
    ratio: vol20 ? +(lastV / vol20).toFixed(2) : null,
    lastVol: lastV,
    sma20: vol20,
  };
}

function analyze(candles3m, bias) {
  if (!candles3m?.length || !bias) return { pass: false, reason: 'no_data' };

  const fvg        = detectFVG(candles3m, bias);
  const rejection  = detectRejection(candles3m, bias);
  const aggression = detectAggression(candles3m);

  // At least 2 of 3 must pass; FVG is mandatory
  const confirmations = [fvg.reacting, rejection.detected, aggression.detected].filter(Boolean).length;
  const pass = fvg.detected && fvg.reacting && confirmations >= 2;

  return {
    pass,
    fvg,
    rejection,
    aggression,
    confirmations,
    reason: !fvg.detected ? 'no_fvg'
          : !fvg.reacting ? 'price_not_in_fvg'
          : confirmations < 2 ? `only_${confirmations}_confirms`
          : 'ok',
  };
}

module.exports = { analyze };
