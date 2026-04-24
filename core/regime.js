'use strict';
// regime.js — ADX + EMA slope + volatility
const { ema, atr } = require('./indicators');

function adx(candles, period = 14) {
  if (candles.length < period * 2) return null;
  const dmPlus = [], dmMinus = [], trs = [];

  for (let i = 1; i < candles.length; i++) {
    const { h, l } = candles[i];
    const ph = candles[i - 1].h, pl = candles[i - 1].l, pc = candles[i - 1].c;
    dmPlus.push(Math.max(0, (h - ph) > (pl - l) ? h - ph : 0));
    dmMinus.push(Math.max(0, (pl - l) > (h - ph) ? pl - l : 0));
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }

  const smTR  = trs.slice(0, period).reduce((a, b) => a + b,0);
  const smDMp = dmPlus.slice(0, period).reduce((a, b) => a + b,0);
  const smDMm = dmMinus.slice(0, period).reduce((a, b) => a + b,0);

  let smTRc = smTR, smDMpc = smDMp, smDMmc = smDMm;
  const dx = [];

  for (let i = period; i < trs.length; i++) {
    smTRc  = smTRc  - smTRc  / period + trs[i];
    smDMpc = smDMpc - smDMpc / period + dmPlus[i];
    smDMmc = smDMmc - smDMmc / period + dmMinus[i];
    const diP = smTRc ? 100 * smDMpc / smTRc : 0;
    const diM = smTRc ? 100 * smDMmc / smTRc : 0;
    const dxVal = (diP + diM) ? 100 * Math.abs(diP - diM) / (diP + diM) : 0;
    dx.push(dxVal);
  }

  return dx.slice(-period).reduce((a, b) => a + b,0) / period;
}

function detectRegime(candles) {
  if (candles.length < 50) return { valid: false };

  const closes = candles.map(c => c.c);
  const ema21  = ema(closes, 21);
  const ema50  = ema(closes, 50);
  const adxVal = adx(candles, 14);
  const atrVal = atr(candles, 14);
  const price  = closes[closes.length - 1];

  const slope = ema21 && ema50 ? (ema21 - ema50) / ema50 : 0;
  const trend = adxVal > 25 ? (slope > 0 ? 'UP' : 'DOWN') : 'RANGE';
  const volatility = atrVal && price ? atrVal / price : 0; // ATR% of price

  return {
    valid: true,
    adx: adxVal,
    trend,
    slope,
    volatility,
    ema21,
    ema50,
    atr: atrVal,
    // S9 filter: avoid trading in ranging low-vol markets
    tradeable: adxVal > 20 && volatility > 0.003,
  };
}

module.exports = { detectRegime, adx };
