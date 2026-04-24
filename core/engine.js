'use strict';
// engine.js — Loop principal del motor S9
// Corre 24/7. Solo ejecuta dentro de ventanas COT.

require('dotenv').config();
const axios   = require('axios');
const fs      = require('fs');
const path    = require('path');
const signal  = require('./signal');
const windows = require('./windows');

const BINANCE  = 'https://fapi.binance.com';
const SYMBOLS  = ['BTCUSDT', 'ETHUSDT'];
const INTERVAL_MS = 60_000; // tick cada 1 min

let state = {
  mode:     process.env.MODE ?? 'STOP',
  running:  false,
  equity:   parseFloat(process.env.PAPER_EQUITY ?? '10000'),
  lastSignal: null,
  dailyPnL: 0,
  positions: [],
  loopCount: 0,
};

// ── Data fetch ────────────────────────────────────────────────
async function fetchKlines(symbol, interval, limit = 100) {
  const url = `${BINANCE}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const { data } = await axios.get(url, { timeout: 8000 });
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

// ── Kill switch ───────────────────────────────────────────────
function checkKillSwitch() {
  if (state.dailyPnL / state.equity < -0.05) {
    log('KILL_SWITCH: DD diario >5% — motor en STOP', 'error');
    state.mode = 'STOP';
    return true;
  }
  return false;
}

// ── Log ───────────────────────────────────────────────────────
const logFile = path.join(__dirname, '..', 'logs', 's9.log');
function log(msg, level = 'info') {
  const col = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  const line = `[${col}] [${level.toUpperCase()}] ${msg}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(logFile, line); } catch {}
  // Emit to GUI via global emitter if available
  if (global.guiEmit) global.guiEmit('log', { level, msg, ts: col });
}

// ── Signal to state ───────────────────────────────────────────
function saveSignal(result) {
  state.lastSignal = result;
  const logPath = path.join(__dirname, '..', 'state', 'signals.log');
  const line = JSON.stringify({ ...result, ts: new Date().toISOString() }) + '\n';
  try { fs.appendFileSync(logPath, line); } catch {}
}

// ── Main tick ─────────────────────────────────────────────────
async function tick() {
  if (state.mode === 'STOP') { log('mode=STOP, skipping tick'); return; }

  state.loopCount++;
  if (checkKillSwitch()) return;

  const win = windows.getCurrentWindow();
  const config = loadConfig();

  log(`tick #${state.loopCount} | window=${win.name} | mode=${state.mode}`);

  // Always gather data and evaluate signal (for logging)
  let btcData, ethData;
  try {
    [btcData, ethData] = await Promise.all([
      gatherData('BTCUSDT'),
      gatherData('ETHUSDT'),
    ]);
  } catch (e) {
    log(`data fetch error: ${e.message}`, 'error');
    return;
  }

  const result = signal.evaluate({
    btcData,
    ethData: { h1: ethData.h1 },
    equity: state.equity,
    config,
  });

  saveSignal(result);
  log(`signal=${result.signal} | reason=${result.reason}`);

  if (!result.signal) return;
  log(`SETUP DETECTED: ${result.side} ${result.symbol} | R:R=${result.trade?.rr}`, 'warn');

  // Only execute within window
  if (!win.active) {
    log(`Setup valid but outside window — OBSERVE only`);
    return;
  }

  if (state.mode === 'OBSERVE') {
    log('mode=OBSERVE — no execution');
    return;
  }

  // Route to executor (paper or live)
  const router = require('../execution/router');
  await router.execute(result.trade, state);
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 's9-rules.json'), 'utf8'));
  } catch { return {}; }
}

// ── Public API ────────────────────────────────────────────────
let loopHandle = null;

function start() {
  if (state.running) return;
  state.running = true;
  log('Engine started');
  tick(); // immediate first tick
  loopHandle = setInterval(tick, INTERVAL_MS);
}

function stop() {
  if (loopHandle) clearInterval(loopHandle);
  state.running = false;
  log('Engine stopped');
}

function setMode(mode) {
  const allowed = ['STOP', 'OBSERVE', 'PAPER', 'LIVE'];
  if (!allowed.includes(mode)) throw new Error(`Invalid mode: ${mode}`);
  state.mode = mode;
  log(`Mode changed to ${mode}`);
}

function getState() { return { ...state }; }

module.exports = { start, stop, setMode, getState, log };
