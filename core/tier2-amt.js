'use strict';
// tier2-amt.js — Auction Market Theory: location (premium/discount + LVN)
// Returns: { pass, location, pct, nearLVN, vp }

const { volumeProfile } = require('./indicators');

function analyze(dailyCandles, currentPrice, bias) {
  if (!dailyCandles?.length || !currentPrice) return { pass: false, reason: 'no_data' };

  // Use previous day's range as dealing range
  const prev = dailyCandles[dailyCandles.length - 2] ?? dailyCandles[dailyCandles.length - 1];
  const rangeH = prev.h;
  const rangeL = prev.l;
  const rangeSize = rangeH - rangeL;
  if (rangeSize <= 0) return { pass: false, reason: 'zero_range' };

  // Location as % of range (0 = low, 1 = high)
  const pct = (currentPrice - rangeL) / rangeSize;

  const inDiscount = pct < 0.45;
  const inPremium  = pct > 0.55;
  const inMid      = !inDiscount && !inPremium;

  // Volume profile for LVN detection (use last 5 daily candles)
  const vp = volumeProfile(dailyCandles.slice(-5));
  const nearLVN = vp?.lvn?.some(lvnPrice => Math.abs(lvnPrice - currentPrice) / currentPrice < 0.005) ?? false;

  // S9 rule: LONG must be in discount, SHORT in premium
  const locationOk = bias === 'LONG' ? inDiscount : inPremium;

  const pass = locationOk;

  return {
    pass,
    location: inDiscount ? 'DISCOUNT' : inPremium ? 'PREMIUM' : 'MIDPOINT',
    pct: Math.round(pct * 100),
    nearLVN,
    vp: vp ? { poc: vp.poc, vah: vp.vah, val: vp.val } : null,
    rangeH,
    rangeL,
    reason: !locationOk ? `price_in_${inMid ? 'midpoint' : (bias === 'LONG' ? 'premium' : 'discount')}` : 'ok',
  };
}

module.exports = { analyze };
