'use strict';
// backtest/engine.js — Motor de backtest vectorizado S9 sobre histórico Binance
// Descarga H1 + 3m de Binance, agrega H4/D desde H1, evalúa señal en cada vela.

const axios  = require('axios');
const signal = require('../core/signal');

const BINANCE     = 'https://fapi.binance.com';
const SLIP        = 0.0005; // 0.05% slippage market
const FEE         = 0.0005; // 0.05% taker por lado
const LOOKBACK_H1 = 200;    // velas H1 mínimas para indicadores
const M3_WINDOW   = 60;     // velas 3m para tier4
const TIME_STOP_H = 48;     // time stop en horas

// ── Fetch con paginación ─────────────────────────────────────
async function fetchKlines(symbol, interval, days, onProgress) {
  const endTime   = Date.now();
  const startTime = endTime - days * 86400000;
  const all = [];
  let from = startTime;
  let batch = 0;

  while (from < endTime) {
    const { data } = await axios.get(`${BINANCE}/fapi/v1/klines`, {
      params: { symbol, interval, startTime: from, limit: 1500 },
      timeout: 20000,
    });
    if (!data.length) break;
    for (const k of data) {
      all.push({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] });
    }
    from = data[data.length - 1][0] + 1;
    batch++;
    if (onProgress) onProgress(all.length, batch);
    if (data.length < 1500) break;
  }
  return all;
}

// ── Reagregación desde H1 ────────────────────────────────────
function aggregate(h1Candles, msFactor) {
  const g = new Map();
  for (const c of h1Candles) {
    const key = Math.floor(c.t / msFactor) * msFactor;
    if (!g.has(key)) g.set(key, []);
    g.get(key).push(c);
  }
  return [...g.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, s]) => ({
      t: k,
      o: s[0].o,
      h: Math.max(...s.map(c => c.h)),
      l: Math.min(...s.map(c => c.l)),
      c: s[s.length - 1].c,
      v: s.reduce((a, c) => a + c.v, 0),
    }));
}

// ── Búsqueda binaria: primer índice con arr[i].t >= t ────────
function bisect(arr, t) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    arr[mid].t < t ? (lo = mid + 1) : (hi = mid);
  }
  return lo;
}

// ── Loop principal ───────────────────────────────────────────
async function run({ days = 730, equity = 10000, config = {} } = {}) {
  const riskPct = (config?.tier_5_risk_target?.risk_per_trade_pct ?? 0.5) / 100;

  process.stdout.write(`[BACKTEST] ${days}d | equity $${equity} | riskPct ${(riskPct * 100).toFixed(2)}%\n`);
  process.stdout.write('[BACKTEST] Descargando BTC H1...');

  const btcH1All = await fetchKlines('BTCUSDT', '1h', days,
    (n) => process.stdout.write(`\r[BACKTEST] Descargando BTC H1... ${n} velas`));
  process.stdout.write(`\r[BACKTEST] BTC H1: ${btcH1All.length} velas\n`);

  process.stdout.write('[BACKTEST] Descargando BTC 3m + ETH H1 (paralelo)...');
  const [btcM3All, ethH1All] = await Promise.all([
    fetchKlines('BTCUSDT', '3m', days),
    fetchKlines('ETHUSDT', '1h', days),
  ]);
  process.stdout.write(`\r[BACKTEST] BTC 3m: ${btcM3All.length} | ETH H1: ${ethH1All.length}\n`);

  // Reagregar H4 y D desde H1
  const H4_MS = 4 * 3600000;
  const D_MS  = 24 * 3600000;
  const btcH4All = aggregate(btcH1All, H4_MS);
  const btcDAll  = aggregate(btcH1All, D_MS);

  process.stdout.write(`[BACKTEST] BTC H4: ${btcH4All.length} | BTC D: ${btcDAll.length}\n`);
  process.stdout.write(`[BACKTEST] Ejecutando señal en ${btcH1All.length - LOOKBACK_H1} velas H1...\n`);

  const trades  = [];
  let eq        = equity;
  let inTrade   = false;
  let trade     = null;
  let signals   = 0;

  for (let i = LOOKBACK_H1; i < btcH1All.length - 1; i++) {
    const now = btcH1All[i];

    // ── Chequeo de salida ────────────────────────────────────
    if (inTrade && trade) {
      const c     = now;
      const dir   = trade.side === 'LONG' ? 1 : -1;
      const slHit = trade.side === 'LONG' ? c.l <= trade.sl : c.h >= trade.sl;
      const tpHit = trade.side === 'LONG' ? c.h >= trade.tp : c.l <= trade.tp;
      const timeUp = (c.t - trade.entryTime) / 3600000 >= TIME_STOP_H;

      let exitPrice = null;
      let outcome   = null;

      if (slHit)        { exitPrice = trade.sl; outcome = 'SL'; }
      else if (tpHit)   { exitPrice = trade.tp; outcome = 'TP'; }
      else if (timeUp)  { exitPrice = c.c;      outcome = 'TIME'; }

      if (outcome) {
        const pnlRaw  = (exitPrice - trade.entry) / trade.entry * dir;
        const pnlPct  = pnlRaw - FEE * 2;
        const pnlUSD  = +(pnlPct * trade.size * trade.entry).toFixed(2);
        const slDistP = Math.abs(trade.entry - trade.sl) / trade.entry;
        const pnlR    = slDistP > 0 ? +(pnlPct / slDistP).toFixed(2) : 0;
        eq = +(eq + pnlUSD).toFixed(2);

        trades.push({
          ...trade,
          exit:        +exitPrice.toFixed(2),
          exitTime:    c.t,
          outcome,
          pnlPct:      +pnlPct.toFixed(6),
          pnlR,
          pnlUSD,
          equityAfter: eq,
        });
        inTrade = false;
        trade   = null;
      }
    }

    if (inTrade) continue;

    // ── Ventanas de datos sin lookahead ───────────────────────
    const btcH1 = btcH1All.slice(i - LOOKBACK_H1, i);

    // H4: velas completamente cerradas antes de now.t
    const h4End = bisect(btcH4All, now.t - H4_MS + 1);
    const h4Cut = btcH4All.slice(Math.max(0, h4End - 60), h4End);

    // D: días completamente cerrados antes de now.t
    const dEnd  = bisect(btcDAll, now.t - D_MS + 1);
    const dCut  = btcDAll.slice(Math.max(0, dEnd - 60), dEnd);

    // 3m: últimas M3_WINDOW velas 3m cerradas antes de now.t
    const m3End = bisect(btcM3All, now.t);
    const m3Cut = btcM3All.slice(Math.max(0, m3End - M3_WINDOW), m3End);

    // ETH H1: ventana alineada
    const eEnd  = bisect(ethH1All, now.t);
    const ethH1 = ethH1All.slice(Math.max(0, eEnd - LOOKBACK_H1), eEnd);

    if (dCut.length < 50 || h4Cut.length < 50 || ethH1.length < 30) continue;

    // ── Evaluación de señal ──────────────────────────────────
    let result;
    try {
      result = signal.evaluate({
        btcData: {
          daily: dCut,
          h4:    h4Cut,
          h1:    btcH1,
          m3:    m3Cut.length >= 15 ? m3Cut : btcH1.slice(-20),
        },
        ethData: { h1: ethH1 },
        equity:  eq,
        config,
      });
    } catch { continue; }

    if (!result.signal || !result.trade) continue;
    signals++;

    // ── Entrada en apertura de vela siguiente + slippage ─────
    const nextOpen = btcH1All[i + 1].o;
    const entry    = +(nextOpen * (1 + (result.trade.side === 'LONG' ? SLIP : -SLIP))).toFixed(2);
    const riskUSD  = +(eq * riskPct).toFixed(2);
    const slDist   = Math.abs(entry - result.trade.sl);
    if (slDist <= 0) continue;
    const size = +(riskUSD / slDist).toFixed(4);

    inTrade = true;
    trade   = {
      entryTime: btcH1All[i + 1].t,
      symbol:    result.trade.symbol,
      side:      result.trade.side,
      entry,
      sl:        result.trade.sl,
      tp:        result.trade.tp,
      be:        result.trade.be,
      rr:        result.trade.rr,
      size,
      riskUSD,
      equityBefore: eq,
    };
  }

  process.stdout.write(`[BACKTEST] Señales detectadas: ${signals} | Trades ejecutados: ${trades.length}\n`);
  return { trades, equityStart: equity, equityFinal: eq };
}

module.exports = { run };
