'use strict';
// tier5-risk.js — SL / TP / BE / size / Measured Move
// Returns: { pass, sl, tp, be, size, rr, measuredMove }

const { ema, bollinger } = require('./indicators');

function measuredMove(h4Candles) {
  // "Little RZY": find impulse leg, project 1:1 from pullback
  if (h4Candles.length < 10) return null;
  const len = h4Candles.length;
  const swing = h4Candles.slice(-10);
  const hi = Math.max(...swing.map(c => c.h));
  const lo = Math.min(...swing.map(c => c.l));
  return { target: hi + (hi - lo), distance: hi - lo, hi, lo };
}

function calculate({ bias, manipulation, accumRange, atrH4, candles1h, equity, config }) {
  if (!bias || !manipulation?.detected || !atrH4 || !equity) {
    return { pass: false, reason: 'missing_inputs' };
  }

  const riskPct = config?.riskPerTrade ?? 0.005; // default 0.5%
  const riskUSD = equity * riskPct;

  // SL = extremo del sweep ± 0.1 ATR
  const slBuffer = atrH4 * 0.1;
  const sl = bias === 'LONG'
    ? manipulation.swept - slBuffer
    : manipulation.swept + slBuffer;

  const currentPrice = candles1h?.[candles1h.length - 1]?.c;
  if (!currentPrice) return { pass: false, reason: 'no_price' };

  const slDist = Math.abs(currentPrice - sl);
  if (slDist <= 0) return { pass: false, reason: 'zero_sl_dist' };

  // Size (contracts) = riskUSD / slDist
  const size = +(riskUSD / slDist).toFixed(4);

  // TP = MIN(50% dealing range, Measured Move)
  const dealingRange = accumRange ? accumRange.high - accumRange.low : slDist * 3;
  const tp50pct = bias === 'LONG'
    ? currentPrice + dealingRange * 0.5
    : currentPrice - dealingRange * 0.5;

  const mm = measuredMove(candles1h ?? []);
  const mmTarget = mm
    ? (bias === 'LONG' ? mm.hi + mm.distance : mm.lo - mm.distance)
    : null;

  const tpDist50 = Math.abs(tp50pct - currentPrice);
  const tpDistMM = mmTarget ? Math.abs(mmTarget - currentPrice) : Infinity;
  const tp = bias === 'LONG'
    ? currentPrice + Math.min(tpDist50, tpDistMM)
    : currentPrice - Math.min(tpDist50, tpDistMM);

  const tpDist = Math.abs(tp - currentPrice);
  const rr = +(tpDist / slDist).toFixed(2);

  // Minimum R:R from config
  const minRR = config?.minRR ?? 2.0;
  if (rr < minRR) return { pass: false, reason: `rr_${rr}_below_${minRR}`, rr, sl, tp, size };

  // BE = 0.5R
  const be = bias === 'LONG'
    ? currentPrice + slDist * 0.5
    : currentPrice - slDist * 0.5;

  // Bollinger size reduction: if price at outer band, halve size
  const closes = (candles1h ?? []).map(c => c.c);
  const bb = bollinger(closes, 20, 2);
  const atBand = bb && (currentPrice >= bb.upper * 0.998 || currentPrice <= bb.lower * 1.002);
  const finalSize = atBand ? +(size * 0.5).toFixed(4) : size;

  return {
    pass: true,
    sl: +sl.toFixed(2),
    tp: +tp.toFixed(2),
    be: +be.toFixed(2),
    size: finalSize,
    rr,
    atBollingerBand: atBand,
    measuredMove: mm,
    entry: +currentPrice.toFixed(2),
    riskUSD: +riskUSD.toFixed(2),
    reason: 'ok',
  };
}

module.exports = { calculate };
