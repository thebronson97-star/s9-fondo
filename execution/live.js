'use strict';
const crypto = require('crypto');
const axios  = require('axios');

const BASE = 'https://fapi.binance.com';

function getKeys() {
  const key    = process.env.BINANCE_API_KEY;
  const secret = process.env.BINANCE_SECRET;
  if (!key || !secret) throw new Error('BINANCE_API_KEY / BINANCE_SECRET no configuradas en .env');
  return { key, secret };
}

function buildQs(params) {
  const all = { ...params, timestamp: Date.now() };
  const { key, secret } = getKeys();
  const qs  = new URLSearchParams(all).toString();
  const sig = crypto.createHmac('sha256', secret).update(qs).digest('hex');
  return { qs: qs + '&signature=' + sig, key };
}

async function signedPost(path, params) {
  const { qs, key } = buildQs(params);
  const { data } = await axios.post(`${BASE}${path}`, qs, {
    headers: { 'X-MBX-APIKEY': key, 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });
  return data;
}

async function signedGet(path, params = {}) {
  const { qs, key } = buildQs(params);
  const { data } = await axios.get(`${BASE}${path}?${qs}`, {
    headers: { 'X-MBX-APIKEY': key },
    timeout: 10000,
  });
  return data;
}

async function signedDelete(path, params = {}) {
  const { qs, key } = buildQs(params);
  const { data } = await axios.delete(`${BASE}${path}?${qs}`, {
    headers: { 'X-MBX-APIKEY': key },
    timeout: 10000,
  });
  return data;
}

// Coloca MARKET entry en Binance Futures. SL y TP son opcionales.
async function placeOrder(trade) {
  const entrySide = trade.side === 'LONG' ? 'BUY' : 'SELL';
  const exitSide  = trade.side === 'LONG' ? 'SELL' : 'BUY';

  const entry = await signedPost('/fapi/v1/order', {
    symbol:   trade.symbol,
    side:     entrySide,
    type:     'MARKET',
    quantity: trade.size,
  });

  const orders = { entry };

  if (trade.sl != null) {
    orders.sl = await signedPost('/fapi/v1/order', {
      symbol:        trade.symbol,
      side:          exitSide,
      type:          'STOP_MARKET',
      stopPrice:     (+trade.sl).toFixed(2),
      closePosition: 'true',
      timeInForce:   'GTC',
    });
  }

  if (trade.tp != null) {
    orders.tp = await signedPost('/fapi/v1/order', {
      symbol:        trade.symbol,
      side:          exitSide,
      type:          'TAKE_PROFIT_MARKET',
      stopPrice:     (+trade.tp).toFixed(2),
      closePosition: 'true',
      timeInForce:   'GTC',
    });
  }

  return orders;
}

// Sincroniza órdenes SL/TP en Binance tras modificar una posición.
// Cancela todo y re-coloca sólo los que están definidos.
async function syncSLTP(pos) {
  const { symbol, side, sl, tp } = pos;
  const exitSide = side === 'LONG' ? 'SELL' : 'BUY';

  try { await cancelAllOrdersForSymbol(symbol); } catch {}

  const result = {};

  if (sl != null) {
    result.sl = await signedPost('/fapi/v1/order', {
      symbol,
      side:          exitSide,
      type:          'STOP_MARKET',
      stopPrice:     (+sl).toFixed(2),
      closePosition: 'true',
      timeInForce:   'GTC',
    });
  }

  if (tp != null) {
    result.tp = await signedPost('/fapi/v1/order', {
      symbol,
      side:          exitSide,
      type:          'TAKE_PROFIT_MARKET',
      stopPrice:     (+tp).toFixed(2),
      closePosition: 'true',
      timeInForce:   'GTC',
    });
  }

  return result;
}

// Obtiene posiciones abiertas reales desde Binance Futures
async function syncPositions() {
  const data = await signedGet('/fapi/v2/positionRisk');
  return data
    .filter(p => parseFloat(p.positionAmt) !== 0)
    .map(p => {
      const amt   = parseFloat(p.positionAmt);
      const entry = parseFloat(p.entryPrice);
      const mark  = parseFloat(p.markPrice);
      const pnl   = parseFloat(p.unRealizedProfit);
      return {
        symbol:   p.symbol,
        side:     amt > 0 ? 'LONG' : 'SHORT',
        entry,
        current:  mark,
        size:     Math.abs(amt),
        pnl:      +pnl.toFixed(2),
        pnlPct:   entry ? +((pnl / (entry * Math.abs(amt))) * 100).toFixed(2) : 0,
        source:   'LIVE',
        mode:     'LIVE',
        openedAt: new Date().toISOString(),
      };
    });
}

// Cancela todas las órdenes abiertas de un símbolo
async function cancelAllOrdersForSymbol(symbol) {
  return signedDelete('/fapi/v1/allOpenOrders', { symbol });
}

module.exports = { placeOrder, syncPositions, syncSLTP, cancelAllOrdersForSymbol };
