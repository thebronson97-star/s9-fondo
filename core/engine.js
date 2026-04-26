'use strict';
// engine.js — Motor S9 limpio (sin estrategia hardcodeada)
// Loop 24/7. Solo infraestructura: datos, posiciones, risk, ejecución.
// La estrategia se carga vía plugin-loader cuando el usuario la inserta.

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BINANCE = 'https://fapi.binance.com';
const SYMBOLS = ['BTCUSDT', 'ETHUSDT'];
const INTERVAL_MS = 60_000;
const STATE_FILE = path.join(__dirname, '..', 'state', 'positions.json');

// ── Estado global ─────────────────────────────────────────────
let state = {
  mode: 'STOP',
  running: false,
  equity: parseFloat(process.env.PAPER_EQUITY ?? '10000'),
  baseEquity: parseFloat(process.env.PAPER_EQUITY ?? '10000'),
  maxEquity: parseFloat(process.env.PAPER_EQUITY ?? '10000'),
  lastDate: new Date().toDateString(),
  dailyPnL: 0,
  positions: [],
  loopCount: 0,
  lastSignal: null,
  strategyLoaded: false,
  strategyName: null,
};

// ── Persistencia de estado ────────────────────────────────────
function saveState() {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state.positions, null, 2));
  } catch (e) {
    log(`saveState error: ${e.message}`, 'error');
  }
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      if (Array.isArray(saved)) {
        state.positions = saved;
        log(`${saved.length} posición(es) restaurada(s)`, 'info');
      }
    }
  } catch (e) {
    log(`loadState error: ${e.message}`, 'error');
  }
}
loadState();

// ── Logging ───────────────────────────────────────────────────
const logFile = path.join(__dirname, '..', 'logs', 's9.log');
function log(msg, level = 'info') {
  const col = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  const line = `[${col}] [${level.toUpperCase()}] ${msg}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(logFile, line); } catch {}
  if (global.guiEmit) global.guiEmit('log', { level, msg, ts: col });
}

// ── Fetch de datos ────────────────────────────────────────────
async function fetchKlines(symbol, interval, limit = 100) {
  const url = `${BINANCE}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const { data } = await axios.get(url, { timeout: 8000 });
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`Binance returned empty data for ${symbol} ${interval}`);
  }
  return data.map(k => ({
    t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5],
  }));
}

async function gatherData(symbol) {
  const [daily, h4, h1, m3] = await Promise.all([
    fetchKlines(symbol, '1d', 60),
    fetchKlines(symbol, '4h', 60),
    fetchKlines(symbol, '1h', 60),
    fetchKlines(symbol, '3m', 60),
  ]);
  return { daily, h4, h1, m3 };
}

// ── Equity en tiempo real ─────────────────────────────────────
function getCurrentEquity() {
  const unrealized = state.positions.reduce((sum, p) => sum + (p.pnl || 0), 0);
  return state.baseEquity + state.dailyPnL + unrealized;
}

function updateMaxEquity() {
  const current = getCurrentEquity();
  if (current > state.maxEquity) state.maxEquity = current;
}

// ── Kill switch (drawdown desde peak) ─────────────────────────
function checkKillSwitch() {
  updateMaxEquity();
  const currentEquity = getCurrentEquity();
  const dd = (currentEquity - state.maxEquity) / state.maxEquity;

  if (dd < -0.05) {
    const reason = `DD desde peak ${(dd * 100).toFixed(2)}% (maxEquity=${state.maxEquity.toFixed(2)}, current=${currentEquity.toFixed(2)})`;
    log(`KILL_SWITCH: ${reason} — motor en STOP`, 'error');
    if (global.tg && global.tg.killSwitch) global.tg.killSwitch(reason);
    state.mode = 'STOP';
    return true;
  }

  // Reset dailyPnL si cambió el día
  const today = new Date().toDateString();
  if (state.lastDate !== today) {
    state.dailyPnL = 0;
    state.lastDate = today;
    log('Nuevo día — dailyPnL reseteado', 'info');
  }

  return false;
}

// ── Cierre automático de posiciones ───────────────────────────
function checkExits(priceMap) {
  if (!state.positions.length) return;

  const exits = [];
  for (const pos of state.positions) {
    const price = priceMap[pos.symbol];
    if (!price) continue;

    // SL
    if (pos.sl != null) {
      if (pos.side === 'LONG' && price <= pos.sl) {
        exits.push({ id: pos.id, price, reason: 'SL' });
        continue;
      }
      if (pos.side === 'SHORT' && price >= pos.sl) {
        exits.push({ id: pos.id, price, reason: 'SL' });
        continue;
      }
    }

    // TP
    if (pos.tp != null) {
      if (pos.side === 'LONG' && price >= pos.tp) {
        exits.push({ id: pos.id, price, reason: 'TP' });
        continue;
      }
      if (pos.side === 'SHORT' && price <= pos.tp) {
        exits.push({ id: pos.id, price, reason: 'TP' });
        continue;
      }
    }

    // BE activation
    if (pos.be != null && !pos.beActive) {
      if ((pos.side === 'LONG' && price >= pos.be) ||
          (pos.side === 'SHORT' && price <= pos.be)) {
        pos.sl = pos.entry;
        pos.beActive = true;
        log(`BE activado: ${pos.symbol} @${pos.entry}`, 'info');
        if (global.guiEmit) global.guiEmit('positions', state.positions);
      }
    }
  }

  for (const { id, price, reason } of exits) {
    closePosition(id, price, reason);
  }
}

// ── Multi-estrategia ──────────────────────────────────────────
const vm = require('vm');
let strategyPlugins = []; // [{ plugin, meta }]

// Carga un string de código JS en sandbox y retorna el plugin
function loadOneFromCode(code, name) {
  const ctx = {
    require, module: { exports: {} }, console,
    Math, Date, JSON, Array, Object, Number, String, Boolean,
    parseFloat, parseInt, isNaN, isFinite, setTimeout, clearTimeout,
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { timeout: 5000, filename: name });
  const plugin = ctx.module.exports;
  if (typeof plugin.evaluate !== 'function') {
    throw new Error('El código no exporta evaluate(data)');
  }
  return plugin;
}

// Normaliza cualquier formato de retorno al formato del motor
function normalizeSignal(raw, meta, priceMap) {
  if (!raw) return null;
  // Formato correcto — pasar directo
  if (raw.pass === true && raw.trade) return raw;

  // Formato legacy: { action/side, stopLoss/sl, takeProfit/tp, size }
  const action = raw.action || raw.side;
  if (!action) return null;

  const sym   = (meta.symbols && meta.symbols[0]) || 'BTCUSDT';
  const price = priceMap[sym];
  if (!price) return null;

  const side = (action === 'BUY' || action === 'LONG') ? 'LONG' : 'SHORT';
  const sl   = raw.stopLoss ?? raw.sl ?? null;
  const tp   = raw.takeProfit ?? raw.tp ?? null;
  // Limitar tamaño: máx 0.01 BTC por seguridad en paper
  const size = raw.size && raw.size > 0 ? Math.min(+(+raw.size).toFixed(6), 0.01) : 0.001;

  // Validar dirección SL/TP
  if (sl != null && side === 'LONG'  && sl >= price) return null;
  if (sl != null && side === 'SHORT' && sl <= price) return null;
  if (tp != null && side === 'LONG'  && tp <= price) return null;
  if (tp != null && side === 'SHORT' && tp >= price) return null;

  const slD = sl != null ? Math.abs(price - sl) : null;
  const tpD = tp != null ? Math.abs(tp - price) : null;
  const rr  = slD && tpD && slD > 0 ? +(tpD / slD).toFixed(2) : null;

  return {
    pass: true, side, symbol: sym,
    reason: 'strategy_signal', rr, conf: 1.0,
    trade: {
      symbol: sym, side, entry: price,
      sl: sl != null ? +sl.toFixed(2) : null,
      tp: tp != null ? +tp.toFixed(2) : null,
      size, rr, strategy: meta.name || 'unnamed',
    },
  };
}

// Carga TODAS las estrategias activas desde state/strategies.json
function loadStrategies() {
  const STRATS_FILE = path.join(__dirname, '..', 'state', 'strategies.json');
  const CODES_FILE  = path.join(__dirname, '..', 'state', 'strategy-codes.json');
  const newPlugins  = [];

  let strategies = [];
  try {
    if (fs.existsSync(STRATS_FILE))
      strategies = JSON.parse(fs.readFileSync(STRATS_FILE, 'utf8'));
  } catch (e) { log(`loadStrategies: ${e.message}`, 'error'); }

  // strategy-codes.json tiene la última versión del código (guardado desde editor)
  let savedCodes = {};
  try {
    if (fs.existsSync(CODES_FILE))
      savedCodes = JSON.parse(fs.readFileSync(CODES_FILE, 'utf8'));
  } catch {}

  for (const meta of strategies.filter(s => s.active)) {
    // Prioridad: strategy-codes.json > customCode embebido
    const code = savedCodes[meta.id] || meta.customCode;
    if (!code) continue;
    try {
      const plugin = loadOneFromCode(code, meta.name);
      newPlugins.push({ plugin, meta });
      log(`Estrategia cargada: "${meta.name}"`, 'info');
    } catch (e) {
      log(`Error en "${meta.name}": ${e.message}`, 'error');
    }
  }

  // Fallback: config/active-strategy.js si no hay ninguna activa en state
  if (newPlugins.length === 0) {
    const cfgPath = path.join(__dirname, '..', 'config', 'active-strategy.js');
    if (fs.existsSync(cfgPath)) {
      try {
        delete require.cache[require.resolve(cfgPath)];
        const plugin = require(cfgPath);
        if (typeof plugin.evaluate === 'function') {
          newPlugins.push({ plugin, meta: { name: plugin.name || 'config', symbols: ['BTCUSDT', 'ETHUSDT'], _file: true } });
          log(`Fallback a config/active-strategy.js: ${plugin.name || 'unnamed'}`, 'info');
        }
      } catch (e) { log(`loadStrategies fallback: ${e.message}`, 'error'); }
    }
  }

  // Preservar estrategias cargadas desde archivo (loadStrategy) si las hay
  const fileBased = strategyPlugins.filter(e => e.meta._file && !newPlugins.some(n => n.meta._file));
  strategyPlugins = [...newPlugins, ...fileBased];

  state.strategyLoaded = strategyPlugins.length > 0;
  state.strategyName   = strategyPlugins.map(e => e.meta.name).join(', ') || null;
  log(`${strategyPlugins.length} estrategia(s): ${state.strategyName || 'ninguna'}`, 'info');
  return strategyPlugins.length;
}

// Carga/descarga una estrategia desde archivo (llamado por /api/strategy/load)
function loadStrategy(pluginPath) {
  try {
    // Remover cualquier estrategia previa cargada desde archivo
    strategyPlugins = strategyPlugins.filter(e => !e.meta._file);

    if (pluginPath && fs.existsSync(pluginPath)) {
      delete require.cache[require.resolve(pluginPath)];
      const plugin = require(pluginPath);
      if (!plugin || typeof plugin.evaluate !== 'function') {
        log(`El archivo no exporta evaluate(): ${pluginPath}`, 'error');
        state.strategyLoaded = strategyPlugins.length > 0;
        state.strategyName   = strategyPlugins.map(e => e.meta.name).join(', ') || null;
        return false;
      }
      const meta = { name: plugin.name || path.basename(pluginPath, '.js'), symbols: ['BTCUSDT', 'ETHUSDT'], _file: true };
      strategyPlugins.push({ plugin, meta });
      log(`Estrategia (archivo) cargada: ${meta.name}`, 'info');
    } else {
      log('Estrategia de archivo descargada', 'info');
    }

    state.strategyLoaded = strategyPlugins.length > 0;
    state.strategyName   = strategyPlugins.map(e => e.meta.name).join(', ') || null;
    return strategyPlugins.some(e => e.meta._file);
  } catch (e) {
    log(`Error loadStrategy: ${e.message}`, 'error');
    return false;
  }
}

function evaluateStrategy(marketData) {
  if (!strategyPlugins.length) return { pass: false, reason: 'no_strategy_loaded' };
  try {
    const { plugin, meta } = strategyPlugins[0];
    const raw = plugin.evaluate(marketData);
    return normalizeSignal(raw, meta, marketData.prices) || { pass: false, reason: 'no_signal' };
  } catch (e) {
    log(`Error en estrategia: ${e.message}`, 'error');
    return { pass: false, reason: 'strategy_error' };
  }
}

// ── Señales ───────────────────────────────────────────────────
const SIGNALS_FILE = path.join(__dirname, '..', 'state', 'signals.json');

function saveSignal(signal) {
  try {
    let signals = [];
    try { signals = JSON.parse(fs.readFileSync(SIGNALS_FILE, 'utf8')); } catch {}
    signals.unshift(signal);
    if (signals.length > 100) signals = signals.slice(0, 100);
    fs.writeFileSync(SIGNALS_FILE, JSON.stringify(signals, null, 2));
  } catch {}
}

// ── Tick principal ────────────────────────────────────────────
let tickRunning = false;

async function tick() {
  if (state.mode === 'STOP') {
    log('mode=STOP, skipping tick');
    return;
  }
  if (tickRunning) {
    log('tick in progress, skipping interval');
    return;
  }

  tickRunning = true;
  try {
    await _tick();
  } catch (e) {
    log(`FATAL tick error: ${e.message}`, 'error');
  } finally {
    tickRunning = false;
  }
}

async function _tick() {
  state.loopCount++;
  if (checkKillSwitch()) return;

  const currentEquity = getCurrentEquity();
  log(`tick #${state.loopCount} | mode=${state.mode} | equity=${currentEquity.toFixed(2)} | positions=${state.positions.length}`);

  // 1. Collect unique symbols needed across all active strategies
  const allSymbols = [...new Set([
    'BTCUSDT', 'ETHUSDT',
    ...strategyPlugins.flatMap(({ meta }) => meta.symbols || ['BTCUSDT']),
  ])];

  // 2. Fetch data for all symbols in parallel
  const dataMap = {};
  try {
    const results = await Promise.all(allSymbols.map(sym => gatherData(sym)));
    allSymbols.forEach((sym, i) => { dataMap[sym] = results[i]; });
  } catch (e) {
    log(`data fetch error: ${e.message}`, 'error');
    return;
  }

  // 3. Build price map
  const priceMap = {};
  for (const [sym, d] of Object.entries(dataMap)) {
    priceMap[sym] = d.h1[d.h1.length - 1]?.c;
  }

  // 4. Update open positions and check SL/TP
  updatePositionPrices(priceMap);
  checkExits(priceMap);

  // 5. Evaluate each strategy on each of its configured symbols
  const btcData = dataMap['BTCUSDT'];
  const ethData = dataMap['ETHUSDT'];

  for (const { plugin, meta } of strategyPlugins) {
    const symbols = (meta.symbols && meta.symbols.length) ? meta.symbols : ['BTCUSDT'];

    for (const sym of symbols) {
      const symData  = dataMap[sym] || btcData;
      const symPrice = priceMap[sym] || priceMap['BTCUSDT'];

      const evalData = {
        btcData,
        ethData: ethData ? { h1: ethData.h1 } : null,
        symData,
        prices: priceMap,
        equity: currentEquity,
        positions: state.positions,
        symbol: sym,
        close: symPrice,
        price: symPrice,
      };

      let raw;
      try {
        raw = plugin.evaluate(evalData);
      } catch (e) {
        log(`Error en "${meta.name}" [${sym}]: ${e.message}`, 'error');
        continue;
      }

      const metaForSym = { ...meta, symbols: [sym] };
      const result = normalizeSignal(raw, metaForSym, priceMap);
      if (!result || !result.pass) continue;

      log(`SETUP [${meta.name}] [${sym}]: ${result.side} | R:R=${result.rr || 'N/A'}`, 'warn');
      const signalPayload = { ...result, signal: true, ts: new Date().toISOString() };
      saveSignal(signalPayload);
      if (global.guiEmit) global.guiEmit('signal', signalPayload);
      try { if (global.tg && global.tg.signal) global.tg.signal(result); } catch {}

      if (state.mode === 'OBSERVE') {
        log(`mode=OBSERVE — no execution [${meta.name}]`, 'info');
        continue;
      }

      try {
        const router = require('../execution/router');
        await router.execute(result.trade, state);
      } catch (e) {
        log(`Router error [${meta.name}] [${sym}]: ${e.message}`, 'error');
      }
    }
  }
}

// ── Gestión de posiciones ─────────────────────────────────────
let _posId = Date.now();

function openPosition(trade, source = 'AUTO') {
  const id = ++_posId;
  const pos = {
    id,
    symbol: trade.symbol,
    side: trade.side,
    entry: +trade.entry,
    current: +trade.entry,
    sl: trade.sl != null ? +trade.sl : null,
    tp: trade.tp != null ? +trade.tp : null,
    be: trade.be != null ? +trade.be : null,
    beActive: false,
    size: +trade.size,
    rr: trade.rr != null ? +trade.rr : null,
    riskUSD: trade.riskUSD != null ? +trade.riskUSD : null,
    pnl: 0,
    pnlPct: 0,
    source: source,
    mode: state.mode,
    openedAt: new Date().toISOString(),
  };
  state.positions = [...state.positions, pos];
  saveState();
  log(`Posición abierta: ${pos.side} ${pos.symbol} @${pos.entry} size=${pos.size} id=${pos.id}`);
  if (global.guiEmit) {
    global.guiEmit('positions', state.positions);
    global.guiEmit('log', { level: 'info', msg: `📈 ${pos.side} ${pos.symbol} @${pos.entry} abierta` });
  }
  return pos;
}

function closePosition(id, exitPrice, reason = 'MANUAL') {
  const pos = state.positions.find(p => p.id === id);
  if (!pos) return null;

  const exit = exitPrice ? +exitPrice : pos.current;
  const pnl = pos.side === 'LONG'
    ? (exit - pos.entry) * pos.size
    : (pos.entry - exit) * pos.size;

  state.positions = state.positions.filter(p => p.id !== id);
  state.dailyPnL = +(state.dailyPnL + pnl).toFixed(2);
  saveState();

  log(`Posición cerrada [${reason}]: ${pos.side} ${pos.symbol} @${exit} pnl=${pnl.toFixed(2)}`);
  if (global.guiEmit) {
    global.guiEmit('positions', state.positions);
    global.guiEmit('log', { level: 'info', msg: `📉 ${pos.side} ${pos.symbol} @${exit} cerrada P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}` });
    global.guiEmit('state', { equity: getCurrentEquity(), dailyPnL: state.dailyPnL, mode: state.mode });
  }

  try {
    const line = [
      new Date().toISOString(),
      pos.symbol,
      pos.side + '_CLOSE',
      pos.entry,
      pos.sl,
      pos.tp,
      exit,
      pos.rr,
      pos.size,
      pnl.toFixed(2),
      reason,
    ].join(',') + '\n';
    fs.appendFileSync(path.join(__dirname, '..', 'trades_s9.csv'), line);
  } catch {}

  try {
    if (global.tg && global.tg.exit) {
      const pnlPct = pos.entry ? (pnl / (pos.entry * pos.size)) * 100 : 0;
      global.tg.exit(pos, pnl, pnlPct, reason);
    }
  } catch {}

  return { pos, pnl: +pnl.toFixed(2) };
}

let _lastPosBroadcast = 0;
function updatePositionPrices(priceMap) {
  if (!state.positions.length) return;

  state.positions = state.positions.map(pos => {
    const current = priceMap[pos.symbol];
    if (!current) return pos;
    const pnl = pos.side === 'LONG'
      ? (current - pos.entry) * pos.size
      : (pos.entry - current) * pos.size;
    const pnlPct = pos.entry ? (pnl / (pos.entry * pos.size)) * 100 : 0;
    return {
      ...pos,
      current: +current,
      pnl: +pnl.toFixed(2),
      pnlPct: +pnlPct.toFixed(2),
    };
  });

  const now = Date.now();
  if (global.guiEmit && now - _lastPosBroadcast > 500) {
    _lastPosBroadcast = now;
    global.guiEmit('positions', state.positions);
  }
}

function updatePosition(id, patch) {
  const idx = state.positions.findIndex(p => p.id === id);
  if (idx < 0) return null;

  const safe = {};
  if ('sl' in patch) safe.sl = patch.sl !== null && patch.sl !== '' ? +patch.sl : null;
  if ('tp' in patch) safe.tp = patch.tp !== null && patch.tp !== '' ? +patch.tp : null;
  if ('be' in patch && patch.be != null) safe.be = +patch.be;

  if (!Object.keys(safe).length) return state.positions[idx];

  state.positions = [...state.positions];
  state.positions[idx] = { ...state.positions[idx], ...safe };
  saveState();

  if (global.guiEmit) global.guiEmit('positions', state.positions);
  log(`Posición ${id} actualizada: ${JSON.stringify(safe)}`);
  return state.positions[idx];
}

// ── API pública ───────────────────────────────────────────────
let loopHandle = null;

function start() {
  if (state.running) return;
  state.running = true;
  log('Engine started');

  loadStrategies();

  tick();
  loopHandle = setInterval(tick, INTERVAL_MS);

  if (global.tg && global.tg.heartbeat) {
    setInterval(() => global.tg.heartbeat(getState()), 4 * 3600000);
  }
}

function stop() {
  if (loopHandle) clearInterval(loopHandle);
  loopHandle = null;
  state.running = false;
  log('Engine stopped');
}

function setMode(mode) {
  const allowed = ['STOP', 'OBSERVE', 'PAPER', 'LIVE'];
  if (!allowed.includes(mode)) throw new Error(`Invalid mode: ${mode}`);
  state.mode = mode;
  log(`Mode changed to ${mode}`);
}

function getState() {
  return {
    ...state,
    currentEquity: getCurrentEquity(),
  };
}

// ── Exports ───────────────────────────────────────────────────
module.exports = {
  start,
  stop,
  setMode,
  getState,
  log,
  openPosition,
  closePosition,
  updatePositionPrices,
  updatePosition,
  checkExits,
  loadStrategy,
  loadStrategies,
  evaluateStrategy,
};
