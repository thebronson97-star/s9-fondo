'use strict';
// indicators.js — EMA, SMA, ATR, Bollinger, RSI, Volume Profile
// Candle shape: { t, o, h, l, c, v }

function ema(arr, period) {
  if (arr.length < period) return null;
  const k = 2 / (period + 1);
  let val = arr.slice(0, period).reduce((a, b) => a + b,0) / period;
  for (let i = period; i < arr.length; i++) val = arr[i] * k + val * (1 - k);
  return val;
}

function sma(arr, period) {
  if (arr.length < period) return null;
  return arr.slice(-period).reduce((a, b) => a + b,0) / period;
}

function atr(candles, period = 14) {
  if (candles.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const { h, l } = candles[i];
    const pc = candles[i - 1].c;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return sma(trs, period);
}

function bollinger(arr, period = 20, stdMult = 2) {
  if (arr.length < period) return null;
  const slice = arr.slice(-period);
  const mid = slice.reduce((a, b) => a + b,0) / period;
  const std = Math.sqrt(slice.reduce((s, v) => s + (v - mid) ** 2,0) / period);
  return { upper: mid + stdMult * std, mid, lower: mid - stdMult * std, std };
}

function rsi(arr, period = 14) {
  if (arr.length < period + 1) return null;
  const slice = arr.slice(-(period + 1));
  let gains = 0, losses = 0;
  for (let i = 1; i < slice.length; i++) {
    const d = slice[i] - slice[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  const avgG = gains / period;
  const avgL = losses / period;
  if (avgL === 0) return 100;
  return 100 - 100 / (1 + avgG / avgL);
}

// Volume Profile: VAH/VAL/POC/LVN over candle set
function volumeProfile(candles, bins = 30) {
  if (!candles.length) return null;
  const hi = Math.max(...candles.map(c => c.h));
  const lo = Math.min(...candles.map(c => c.l));
  const step = (hi - lo) / bins;
  const profile = Array.from({ length: bins }, (_, i) => ({
    price: lo + (i + 0.5) * step,
    vol: 0,
  }));

  for (const c of candles) {
    const cVol = c.v / Math.max(1, Math.round((c.h - c.l) / step));
    for (let i = 0; i < bins; i++) {
      const pLo = lo + i * step;
      const pHi = pLo + step;
      if (c.l < pHi && c.h > pLo) profile[i].vol += cVol;
    }
  }

  const sorted = [...profile].sort((a, b) => b.vol - a.vol);
  const totalVol = profile.reduce((s, p) => s + p.vol,0);
  const poc = sorted[0].price;

  // Value Area: 70% of volume around POC
  let cumVol = sorted[0].vol;
  let vaSet = new Set([sorted[0].price]);
  for (let i = 1; i < sorted.length && cumVol / totalVol < 0.7; i++) {
    cumVol += sorted[i].vol;
    vaSet.add(sorted[i].price);
  }
  const vaPrices = [...vaSet].sort((a, b) => a - b);
  const vah = vaPrices[vaPrices.length - 1];
  const val = vaPrices[0];

  // LVN: bins with volume < 20th percentile
  const p20 = sorted[Math.floor(sorted.length * 0.8)].vol;
  const lvn = profile.filter(p => p.vol <= p20 && p.price > lo && p.price < hi).map(p => p.price);

  return { poc, vah, val, lvn, hi, lo };
}

module.exports = { ema, sma, atr, bollinger, volumeProfile };
