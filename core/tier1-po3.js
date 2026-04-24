'use strict';
// tier1-po3.js — Power of Three: bias D + H4
// Returns: { pass, bias, phase, range, confidence }

const { ema, atr } = require('./indicators');

// Detect if candles are in accumulation (lateral range)
function detectAccumulation(candles, atrVal) {
  if (candles.length < 5) return { isRange: false };
  const highs = candles.map(c => c.h);
  const lows  = candles.map(c => c.l);
  const rangeH = Math.max(...highs);
  const rangeL = Math.min(...lows);
  const rangeSize = rangeH - rangeL;
  // Range considered "tight" if < 2.5 ATR
  return {
    isRange: rangeSize < atrVal * 2.5,
    high: rangeH,
    low: rangeL,
    mid: (rangeH + rangeL) / 2,
    size: rangeSize,
  };
}

// Detect manipulation: wick that swept beyond range then rejected
function detectManipulation(candles, accumRange) {
  if (!accumRange.isRange || candles.length < 2) return { detected: false };
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  const sweptLow  = prev.l < accumRange.low  && last.c > accumRange.low;
  const sweptHigh = prev.h > accumRange.high && last.c < accumRange.high;

  if (sweptLow)  return { detected: true, direction: 'LONG',  swept: prev.l, returnTo: accumRange.low };
  if (sweptHigh) return { detected: true, direction: 'SHORT', swept: prev.h, returnTo: accumRange.high };
  return { detected: false };
}

function analyze(dailyCandles, h4Candles) {
  if (!dailyCandles?.length || !h4Candles?.length) return { pass: false, reason: 'no_data' };

  const atrD  = atr(dailyCandles, 14);
  const atrH4 = atr(h4Candles, 14);
  if (!atrD || !atrH4) return { pass: false, reason: 'insufficient_candles' };

  // D1 bias via EMA slope
  const closesD  = dailyCandles.map(c => c.c);
  const ema21D   = ema(closesD, 21);
  const ema50D   = ema(closesD, 50);
  const dailyBias = ema21D > ema50D ? 'LONG' : 'SHORT';

  // H4 PO3 phase
  const h4Recent = h4Candles.slice(-20);
  const h4Accum  = detectAccumulation(h4Recent.slice(-8), atrH4);
  const h4Manip  = detectManipulation(h4Recent.slice(-3), h4Accum);

  // H4 bias consistency with D1
  const closesH4 = h4Candles.map(c => c.c);
  const ema21H4  = ema(closesH4, 21);
  const ema50H4  = ema(closesH4, 50);
  const h4Bias   = ema21H4 > ema50H4 ? 'LONG' : 'SHORT';

  const biasAligned = dailyBias === h4Bias;
  const manipAligned = !h4Manip.detected || h4Manip.direction === dailyBias;

  const pass = biasAligned && h4Accum.isRange;

  return {
    pass,
    bias: dailyBias,
    phase: h4Manip.detected ? 'MANIPULATION' : (h4Accum.isRange ? 'ACCUMULATION' : 'DISTRIBUTION'),
    manipulation: h4Manip,
    accumRange: h4Accum,
    biasAligned,
    manipAligned,
    atrD,
    atrH4,
    reason: !biasAligned ? 'bias_mismatch' : !h4Accum.isRange ? 'no_accumulation' : 'ok',
  };
}

module.exports = { analyze };
