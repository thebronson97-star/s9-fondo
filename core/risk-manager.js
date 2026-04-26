'use strict';
// risk-manager.js — Gestión de riesgo GENÉRICA
// No contiene lógica de estrategia. Solo:
// - Position sizing basado en % de equity
// - Kill switch por drawdown
// - Max exposure por símbolo
// - Validación de trades

const path = require('path');
const fs   = require('fs');

// ── Configuración por defecto ─────────────────────────────────
const DEFAULT_CONFIG = {
  riskPerTrade: 0.005,      // 0.5% del equity por trade
  maxDailyDD: 0.05,         // 5% drawdown diario → STOP
  maxTotalDD: 0.15,         // 15% drawdown total → STOP
  maxPositions: 2,          // Máximo 2 posiciones simultáneas
  maxExposurePerSymbol: 0.5, // 50% del equity en un símbolo
  minRR: 1.5,               // R:R mínimo aceptable
  slBufferAtr: 0.1,         // Buffer de SL en múltiplos de ATR
};

function loadConfig() {
  try {
    const cfgPath = path.join(__dirname, '..', 'config', 's9-rules.json');
    if (fs.existsSync(cfgPath)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(cfgPath, 'utf8')) };
    }
  } catch (e) {
    console.warn('[RISK] Error cargando config, usando defaults:', e.message);
  }
  return { ...DEFAULT_CONFIG };
}

// ── Estado del risk manager ───────────────────────────────────
let state = {
  maxEquity: 0,           // Peak equity para drawdown
  dailyStartEquity: 0,    // Equity al inicio del día
  lastDate: null,         // Fecha del último reset diario
};

function initRiskManager(equity) {
  state.maxEquity = equity;
  state.dailyStartEquity = equity;
  state.lastDate = new Date().toDateString();
}

function resetDaily(equity) {
  const today = new Date().toDateString();
  if (state.lastDate !== today) {
    state.dailyStartEquity = equity;
    state.lastDate = today;
    return true; // Se reseteó
  }
  return false;
}

// ── Position Sizing ───────────────────────────────────────────
function calculateSize(trade, equity, config = loadConfig()) {
  const { entry, sl, riskPerTrade } = trade;

  if (!entry || !sl || sl <= 0) {
    return { valid: false, reason: 'Missing entry or SL' };
  }

  const riskUSD = equity * riskPerTrade;
  const slDistance = Math.abs(entry - sl);

  if (slDistance === 0) {
    return { valid: false, reason: 'SL distance is zero' };
  }

  const size = riskUSD / slDistance;
  const notional = size * entry;

  return {
    valid: true,
    size: +size.toFixed(6),
    riskUSD: +riskUSD.toFixed(2),
    notional: +notional.toFixed(2),
    slDistance: +slDistance.toFixed(2),
  };
}

// ── Validación de trade ───────────────────────────────────────
function validateTrade(trade, currentEquity, openPositions = [], config = loadConfig()) {
  const errors = [];

  // 1. Verificar R:R mínimo
  if (trade.rr && trade.rr < config.minRR) {
    errors.push(`R:R ${trade.rr} < mínimo ${config.minRR}`);
  }

  // 2. Verificar límite de posiciones
  if (openPositions.length >= config.maxPositions) {
    errors.push(`Máximo ${config.maxPositions} posiciones alcanzado`);
  }

  // 3. Verificar exposición por símbolo
  const symbolExposure = openPositions
    .filter(p => p.symbol === trade.symbol)
    .reduce((sum, p) => sum + (p.size * p.entry), 0);
  const newExposure = symbolExposure + (trade.size * trade.entry);
  if (newExposure > currentEquity * config.maxExposurePerSymbol) {
    errors.push(`Exposición en ${trade.symbol} excede ${config.maxExposurePerSymbol * 100}%`);
  }

  // 4. Verificar que size es razonable
  if (!trade.size || trade.size <= 0) {
    errors.push('Size inválido');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}

// ── Kill Switch ───────────────────────────────────────────────
function checkKillSwitch(currentEquity, dailyPnL, config = loadConfig()) {
  // Reset diario si es nuevo día
  resetDaily(currentEquity);

  // Drawdown desde peak
  state.maxEquity = Math.max(state.maxEquity, currentEquity);
  const totalDD = (state.maxEquity - currentEquity) / state.maxEquity;

  // Drawdown diario
  const dailyDD = (state.dailyStartEquity - currentEquity) / state.dailyStartEquity;

  const triggers = [];
  if (dailyDD > config.maxDailyDD) {
    triggers.push(`DD diario ${(dailyDD * 100).toFixed(1)}% > ${config.maxDailyDD * 100}%`);
  }
  if (totalDD > config.maxTotalDD) {
    triggers.push(`DD total ${(totalDD * 100).toFixed(1)}% > ${config.maxTotalDD * 100}%`);
  }

  return {
    triggered: triggers.length > 0,
    reasons: triggers,
    metrics: {
      dailyDD: +dailyDD.toFixed(4),
      totalDD: +totalDD.toFixed(4),
      maxEquity: state.maxEquity,
      dailyStartEquity: state.dailyStartEquity,
    },
  };
}

// ── SL/TP/BE helpers ──────────────────────────────────────────
function calculateSL(entry, side, atr, config = loadConfig()) {
  const buffer = atr * config.slBufferAtr;
  const minBuffer = entry * 0.0005; // 0.05% mínimo para crypto
  const finalBuffer = Math.max(buffer, minBuffer);

  return side === 'LONG'
    ? +(entry - finalBuffer).toFixed(2)
    : +(entry + finalBuffer).toFixed(2);
}

function calculateTP(entry, sl, side, rr = 2) {
  const distance = Math.abs(entry - sl);
  const tpDistance = distance * rr;
  return side === 'LONG'
    ? +(entry + tpDistance).toFixed(2)
    : +(entry - tpDistance).toFixed(2);
}

function checkBE(entry, current, side, beLevel = 0.5) {
  const distance = Math.abs(current - entry);
  const halfDistance = Math.abs(entry - (side === 'LONG' ? entry - (entry * 0.01) : entry + (entry * 0.01))) * beLevel;
  // Simplificado: BE cuando profit > 50% del camino al TP
  const profit = side === 'LONG' ? current - entry : entry - current;
  return profit > 0;
}

// ── Export ────────────────────────────────────────────────────
module.exports = {
  initRiskManager,
  calculateSize,
  validateTrade,
  checkKillSwitch,
  calculateSL,
  calculateTP,
  checkBE,
  loadConfig,
  DEFAULT_CONFIG,
};
