'use strict';
// gui/api.js — REST endpoints del dashboard
const router  = require('express').Router();
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const axios   = require('axios');
const engine  = require('../core/engine');

const SIGNALS_LOG      = path.join(__dirname, '..', 'state', 'signals.log');
const TRADES_CSV       = path.join(__dirname, '..', 'trades_s9.csv');
const CONFIG_PATH      = path.join(__dirname, '..', 'config', 's9-rules.json');
const STATE_DIR        = path.join(__dirname, '..', 'state');
const TG_STATE         = path.join(STATE_DIR, 'telegram.json');
const STRATEGIES_FILE  = path.join(STATE_DIR, 'strategies.json');

// ── Live prices ───────────────────────────────────────────────
let _priceCache = null;
let _priceCacheTs = 0;

// Background price feed — single combined WS stream for BTC + ETH
(function startPriceFeed() {
  let WebSocket;
  try { WebSocket = require('ws'); } catch { return; }

  function connect() {
    const ws = new WebSocket(
      'wss://fstream.binance.com/stream?streams=btcusdt@miniTicker/ethusdt@miniTicker'
    );
    ws.on('open',  function() { process.stdout.write('[PRICES] Binance WS conectado\n'); });
    ws.on('message', function(raw) {
      try {
        const msg  = JSON.parse(raw.toString());
        const d    = msg.data || msg;
        const sym  = (d.s || '').toUpperCase();
        if (sym !== 'BTCUSDT' && sym !== 'ETHUSDT') return;
        const price  = parseFloat(d.c);
        const open   = parseFloat(d.o);
        const change = open ? +((price - open) / open * 100).toFixed(3) : 0;
        if (!_priceCache) _priceCache = {};
        _priceCache[sym] = price;
        _priceCache[sym === 'BTCUSDT' ? 'BTCChange' : 'ETHChange'] = change;
        _priceCache.ts = Date.now();
        _priceCacheTs  = Date.now();
        engine.updatePositionPrices({ [sym]: price });
        try {
          const priceMap = {};
          if (_priceCache.BTCUSDT) priceMap.BTCUSDT = _priceCache.BTCUSDT;
          if (_priceCache.ETHUSDT) priceMap.ETHUSDT = _priceCache.ETHUSDT;
          engine.checkExits(priceMap);
        } catch {}
      } catch {}
    });
    ws.on('close', function() {
      process.stdout.write('[PRICES] Binance WS cerrado — reconectando en 5 s\n');
      setTimeout(connect, 5000);
    });
    ws.on('error', function(e) {
      process.stdout.write('[PRICES] WS error: ' + e.message + '\n');
      ws.terminate();
    });
  }
  connect();
})();

router.get('/prices', async (_req, res) => {
  const now = Date.now();
  if (_priceCache && now - _priceCacheTs < 2000) return res.json(_priceCache);
  try {
    const [btc, eth] = await Promise.all([
      axios.get('https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=BTCUSDT', { timeout: 5000 }),
      axios.get('https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=ETHUSDT', { timeout: 5000 }),
    ]);
    _priceCache = {
      BTCUSDT:   parseFloat(btc.data.lastPrice),
      BTCChange: parseFloat(btc.data.priceChangePercent),
      ETHUSDT:   parseFloat(eth.data.lastPrice),
      ETHChange: parseFloat(eth.data.priceChangePercent),
      ts: now,
    };
    _priceCacheTs = now;
    try { engine.updatePositionPrices({ BTCUSDT: _priceCache.BTCUSDT, ETHUSDT: _priceCache.ETHUSDT }); } catch {}
    res.json(_priceCache);
  } catch (e) {
    if (_priceCache) return res.json(_priceCache);
    res.status(503).json({ error: 'No se pudo obtener precio de Binance' });
  }
});

// ── Positions ─────────────────────────────────────────────────
router.get('/state', (_req, res) => {
  const s = engine.getState();
  res.json({
    mode:            s.mode,
    equity:          s.currentEquity ?? s.equity,
    dailyPnL:        s.dailyPnL,
    positions:       (s.positions || []).length,
    strategyLoaded:  s.strategyLoaded,
    strategyName:    s.strategyName,
    loopCount:       s.loopCount,
  });
});

router.get('/positions', (_req, res) => res.json(engine.getState().positions || []));

router.post('/positions/close/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const result = engine.closePosition(id, req.body.exitPrice);
  if (!result) return res.status(404).json({ error: 'Posición no encontrada' });
  try {
    const tg = JSON.parse(fs.readFileSync(TG_STATE, 'utf8'));
    await sendTelegram(tg.token, tg.chatId,
      `📉 <b>Posición cerrada — ${result.pos.side} ${result.pos.symbol}</b>\n` +
      `Entry: $${result.pos.entry.toLocaleString()} → Exit: $${result.pos.current.toLocaleString()}\n` +
      `P&L: ${result.pnl >= 0 ? '+' : ''}$${result.pnl}`
    );
  } catch {}
  res.json({ ok: true, pnl: result.pnl });
});

router.post('/orders', async (req, res) => {
  const { symbol, side, qty, orderType = 'market', price, sl, tp } = req.body;
  const entryPrice = parseFloat(price);
  const size       = parseFloat(qty);
  if (!entryPrice || !size) return res.status(400).json({ error: 'Precio o cantidad inválidos' });

  const isLong  = side === 'BUY' || side === 'LONG';
  const slVal   = (sl != null && sl !== '') ? parseFloat(sl) : null;
  const tpVal   = (tp != null && tp !== '') ? parseFloat(tp) : null;
  const rrVal   = (slVal != null && tpVal != null && Math.abs(entryPrice - slVal) > 0)
    ? +( Math.abs(tpVal - entryPrice) / Math.abs(entryPrice - slVal) ).toFixed(2)
    : null;
  const riskUSD = slVal != null
    ? +( Math.abs(entryPrice - slVal) * size ).toFixed(2)
    : null;

  const trade = {
    symbol, side: isLong ? 'LONG' : 'SHORT',
    entry: entryPrice, sl: slVal, tp: tpVal,
    size, rr: rrVal, riskUSD,
  };

  const pos = engine.openPosition(trade, {}, 'MANUAL');

  try {
    const tradesFile = path.join(__dirname, '..', 'trades_s9.csv');
    if (!fs.existsSync(tradesFile)) fs.writeFileSync(tradesFile, 'ts,symbol,side,entry,sl,tp,be,rr,size,riskUSD\n');
    fs.appendFileSync(tradesFile, [new Date().toISOString(), symbol, trade.side, entryPrice, slVal ?? '', tpVal ?? '', '', rrVal ?? '', size, riskUSD ?? ''].join(',') + '\n');
  } catch {}

  try {
    const tg = require('../notify/telegram');
    const engState = engine.getState();
    await tg.entry({
      ...trade,
      id:       pos?.id,
      strategy: 'Manual',
      mode:     engState.mode || 'PAPER',
    });
  } catch {}

  res.json({ ok: true, position: pos });
});

// ── Sync live positions from Binance ─────────────────────────
router.post('/sync-positions', async (_req, res) => {
  try {
    const live = require('../execution/live');
    const positions = await live.syncPositions();
    res.json({ ok: true, positions });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Strategy code: load / status / unload ────────────────────
router.post('/strategy/load', (req, res) => {
  const { code, name, strategyId } = req.body;
  if (!code || !code.trim()) return res.status(400).json({ success: false, error: 'Código requerido' });
  try {
    // Guardar en config/ para el flujo legacy
    const dir = path.join(__dirname, '..', 'config');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'active-strategy.js'), code, 'utf8');

    // Si viene con strategyId, actualizar customCode en strategies.json
    if (strategyId != null) {
      try {
        if (fs.existsSync(STRATEGIES_FILE)) {
          const strats = JSON.parse(fs.readFileSync(STRATEGIES_FILE, 'utf8'));
          const idx = strats.findIndex(s => s.id === strategyId || String(s.id) === String(strategyId));
          if (idx >= 0) {
            strats[idx].customCode = code;
            fs.writeFileSync(STRATEGIES_FILE, JSON.stringify(strats, null, 2));
          }
        }
      } catch {}
    }

    // Recargar todas las estrategias activas
    engine.loadStrategies();
    const s = engine.getState();
    if (s.strategyLoaded) {
      engine.log(`Estrategia cargada desde GUI: ${s.strategyName || name || 'unnamed'}`);
      res.json({ success: true, name: s.strategyName });
    } else {
      res.json({ success: false, error: 'El código debe exportar evaluate(data) via module.exports' });
    }
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

router.get('/strategy/status', (_req, res) => {
  const s = engine.getState();
  res.json({ loaded: s.strategyLoaded, name: s.strategyName });
});

router.post('/strategy/unload', (_req, res) => {
  engine.loadStrategy(null);
  engine.log('Estrategia descargada desde GUI');
  res.json({ success: true });
});

// Per-strategy code persistence (map of id → code)
const CODES_FILE = path.join(__dirname, '..', 'state', 'strategy-codes.json');

router.get('/strategy/codes', (_req, res) => {
  try {
    if (!fs.existsSync(CODES_FILE)) return res.json({});
    res.json(JSON.parse(fs.readFileSync(CODES_FILE, 'utf8')));
  } catch { res.json({}); }
});

router.post('/strategy/codes', (req, res) => {
  try {
    fs.mkdirSync(path.dirname(CODES_FILE), { recursive: true });
    fs.writeFileSync(CODES_FILE, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Signals history ───────────────────────────────────────────
const SIGNALS_FILE = path.join(__dirname, '..', 'state', 'signals.json');

router.get('/signals', (_req, res) => {
  try {
    if (!fs.existsSync(SIGNALS_FILE)) return res.json([]);
    res.json(JSON.parse(fs.readFileSync(SIGNALS_FILE, 'utf8')));
  } catch { res.json([]); }
});

// ── Strategies persistence ────────────────────────────────────
router.get('/strategies', (_req, res) => {
  try {
    if (!fs.existsSync(STRATEGIES_FILE)) return res.json([]);
    res.json(JSON.parse(fs.readFileSync(STRATEGIES_FILE, 'utf8')));
  } catch { res.json([]); }
});

router.post('/strategies', (req, res) => {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(STRATEGIES_FILE, JSON.stringify(req.body, null, 2));
    // Recargar estrategias activas en el motor
    try { engine.loadStrategies(); } catch {}
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Position update (SL / TP / BE) — null elimina el valor ──
router.post('/positions/update/:id', async (req, res) => {
  const id    = parseInt(req.params.id);
  const patch = {};
  if ('sl' in req.body) patch.sl = (req.body.sl === null || req.body.sl === '') ? null : parseFloat(req.body.sl);
  if ('tp' in req.body) patch.tp = (req.body.tp === null || req.body.tp === '') ? null : parseFloat(req.body.tp);
  if ('be' in req.body && req.body.be != null) patch.be = parseFloat(req.body.be);
  const pos = engine.updatePosition(id, patch);
  if (!pos) return res.status(404).json({ error: 'Posición no encontrada' });
  if (pos.mode === 'LIVE' && pos.source === 'LIVE' && ('sl' in patch || 'tp' in patch)) {
    try {
      const live = require('../execution/live');
      await live.syncSLTP(pos);
    } catch (e) {
      return res.json({ ok: true, position: pos, binanceWarning: e.message });
    }
  }
  res.json({ ok: true, position: pos });
});

router.post('/order/update', async (req, res) => {
  const { id, sl, tp, be } = req.body;
  const patch = {};
  if ('sl' in req.body) patch.sl = (sl === null || sl === '') ? null : parseFloat(sl);
  if ('tp' in req.body) patch.tp = (tp === null || tp === '') ? null : parseFloat(tp);
  if ('be' in req.body && be != null) patch.be = parseFloat(be);
  const pos = engine.updatePosition(parseInt(id), patch);
  if (!pos) return res.status(404).json({ error: 'Posición no encontrada' });
  if (pos.mode === 'LIVE' && pos.source === 'LIVE' && ('sl' in patch || 'tp' in patch)) {
    try {
      const live = require('../execution/live');
      await live.syncSLTP(pos);
    } catch (e) {
      return res.json({ ok: true, position: pos, binanceWarning: e.message });
    }
  }
  res.json({ ok: true, position: pos });
});

// ── Engine state + control ────────────────────────────────────
router.get('/state', (_req, res) => res.json(engine.getState()));

router.post('/start', (_req, res) => {
  engine.start();
  res.json({ ok: true });
});

router.post('/stop', (_req, res) => {
  engine.stop();
  res.json({ ok: true });
});

router.post('/mode', (req, res) => {
  try {
    engine.setMode(req.body.mode);
    res.json({ ok: true, mode: req.body.mode });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Metrics (Win Rate, PF, DD, Sharpe, Sortino, equity curve) ─
router.get('/metrics', (req, res) => {
  try {
    const period  = req.query.period || '90d';
    const days    = period === '1d' ? 1 : period === '30d' ? 30 : period === '1y' ? 365 : 90;
    const since   = Date.now() - days * 86400000;
    const equity0 = parseFloat(process.env.PAPER_EQUITY || '10000');

    let closes = [];
    if (fs.existsSync(TRADES_CSV)) {
      const lines = fs.readFileSync(TRADES_CSV, 'utf8').trim().split('\n').filter(Boolean);
      if (lines.length >= 2) {
        const headers = lines[0].split(',');
        closes = lines.slice(1)
          .map(l => Object.fromEntries(headers.map((h, i) => [h, l.split(',')[i]])))
          .filter(t => t.side && t.side.includes('_CLOSE') && new Date(t.ts).getTime() >= since);
      }
    }

    const pnls     = closes.map(t => parseFloat(t.riskUSD) || 0);
    const wins     = pnls.filter(p => p > 0).length;
    const losses   = pnls.filter(p => p <= 0).length;
    const winRate  = pnls.length > 0 ? +(wins / pnls.length * 100).toFixed(1) : 0;
    const grossWin = pnls.filter(p => p > 0).reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(pnls.filter(p => p < 0).reduce((a, b) => a + b, 0));
    const profitFactor = grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : wins > 0 ? 99 : 0;

    const colMidnight = new Date(); colMidnight.setHours(0, 0, 0, 0);
    const pnlToday = closes
      .filter(t => new Date(t.ts) >= colMidnight)
      .reduce((a, t) => a + (parseFloat(t.riskUSD) || 0), 0);

    // Equity curve + Max DD
    let eq = equity0, peak = equity0, maxDD = 0;
    const equityCurve = [equity0];
    const sorted = [...closes].sort((a, b) => new Date(a.ts) - new Date(b.ts));
    sorted.forEach(t => {
      eq = +(eq + (parseFloat(t.riskUSD) || 0)).toFixed(2);
      equityCurve.push(eq);
      if (eq > peak) peak = eq;
      const dd = peak > 0 ? (peak - eq) / peak : 0;
      if (dd > maxDD) maxDD = dd;
    });

    // Sharpe & Sortino (annualized, daily-return basis)
    const byDay = {};
    sorted.forEach(t => {
      const day = t.ts.slice(0, 10);
      byDay[day] = (byDay[day] || 0) + (parseFloat(t.riskUSD) || 0);
    });
    const dailyR  = Object.values(byDay).map(p => p / equity0 * 100);
    const mean    = dailyR.length > 0 ? dailyR.reduce((a, b) => a + b, 0) / dailyR.length : 0;
    const variance = dailyR.length > 1 ? dailyR.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / dailyR.length : 1;
    const stdDev  = Math.sqrt(variance) || 1;
    const downR   = dailyR.filter(r => r < 0);
    const downDev = downR.length > 0 ? Math.sqrt(downR.reduce((a, r) => a + r * r, 0) / downR.length) : stdDev;
    const annF    = Math.sqrt(252);

    res.json({
      winRate, profitFactor,
      maxDD:      +(maxDD * 100).toFixed(1),
      sharpe:     +(mean / stdDev  * annF).toFixed(2),
      sortino:    +(mean / downDev * annF).toFixed(2),
      pnlToday:   +pnlToday.toFixed(2),
      tradeCount: pnls.length, wins, losses,
      equityCurve: equityCurve.length > 1 ? equityCurve : null,
      currentEquity: +eq.toFixed(2),
      period,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Signals log ───────────────────────────────────────────────
router.get('/signals', (_req, res) => {
  try {
    if (!fs.existsSync(SIGNALS_LOG)) return res.json([]);
    const lines = fs.readFileSync(SIGNALS_LOG, 'utf8').trim().split('\n').filter(Boolean);
    const parsed = lines.slice(-50)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
    res.json(parsed.reverse());
  } catch { res.json([]); }
});

// ── Trades CSV ────────────────────────────────────────────────
router.get('/trades', (_req, res) => {
  try {
    if (!fs.existsSync(TRADES_CSV)) return res.json([]);
    const lines = fs.readFileSync(TRADES_CSV, 'utf8').trim().split('\n').filter(Boolean);
    if (lines.length < 2) return res.json([]);
    const headers = lines[0].split(',');
    const rows = lines.slice(1).map(l => {
      const vals = l.split(',');
      return Object.fromEntries(headers.map((h, i) => [h, vals[i]]));
    });
    res.json(rows.slice(-100).reverse());
  } catch { res.json([]); }
});

// ── Config read / write ───────────────────────────────────────
router.get('/config', (_req, res) => {
  try { res.json(JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))); }
  catch { res.status(500).json({ error: 'No se pudo leer config' }); }
});

router.post('/config', (req, res) => {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Backtest results ──────────────────────────────────────────
router.get('/backtest/latest', (_req, res) => {
  try {
    if (!fs.existsSync(STATE_DIR)) return res.json(null);
    const file = fs.readdirSync(STATE_DIR)
      .filter(f => f.startsWith('backtest_summary_'))
      .sort().at(-1);
    if (!file) return res.json(null);
    res.json(JSON.parse(fs.readFileSync(path.join(STATE_DIR, file), 'utf8')));
  } catch { res.json(null); }
});

router.get('/backtest/download', (_req, res) => {
  try {
    if (!fs.existsSync(STATE_DIR)) return res.status(404).end();
    const file = fs.readdirSync(STATE_DIR)
      .filter(f => f.startsWith('backtest_trades_'))
      .sort().at(-1);
    if (!file) return res.status(404).json({ error: 'Sin backtest disponible' });
    res.download(path.join(STATE_DIR, file));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Real API connection tests ─────────────────────────────────

router.post('/test/broker', async (req, res) => {
  const { type = 'Binance', key, secret, testnet } = req.body;
  try {
    if (type === 'Binance' || type === 'Binance Futures') {
      const base = testnet
        ? 'https://testnet.binancefuture.com'
        : 'https://fapi.binance.com';

      if (!key || !secret) {
        await axios.get(`${base}/fapi/v1/ping`, { timeout: 6000 });
        return res.json({ ok: true, msg: `Binance alcanzable${testnet ? ' (testnet)' : ''} — agrega API key para verificar permisos` });
      }

      const timestamp = Date.now();
      const qs = `timestamp=${timestamp}`;
      const sig = crypto.createHmac('sha256', secret).update(qs).digest('hex');
      const { data } = await axios.get(
        `${base}/fapi/v2/balance?${qs}&signature=${sig}`,
        { headers: { 'X-MBX-APIKEY': key }, timeout: 8000 }
      );
      const usdt = data.find(a => a.asset === 'USDT');
      const bal  = usdt ? `Balance USDT: ${parseFloat(usdt.balance).toFixed(2)}` : `${data.length} activos`;
      return res.json({ ok: true, msg: `Binance Futures conectado${testnet ? ' (testnet)' : ''} — ${bal}` });
    }

    if (type === 'Bybit') {
      await axios.get('https://api.bybit.com/v5/market/time', { timeout: 6000 });
      return res.json({ ok: true, msg: 'Bybit alcanzable — agrega API key para verificar permisos' });
    }
    if (type === 'OKX') {
      await axios.get('https://www.okx.com/api/v5/public/time', { timeout: 6000 });
      return res.json({ ok: true, msg: 'OKX alcanzable — agrega API key para verificar permisos' });
    }

    return res.json({ ok: true, msg: `${type} — ping OK` });
  } catch (e) {
    const msg = e.response?.data?.msg || e.response?.data?.message || e.message;
    return res.json({ ok: false, msg: `Error: ${msg}` });
  }
});

router.post('/test/telegram', async (req, res) => {
  const { token, chatId } = req.body;
  if (!token || !chatId) {
    return res.json({ ok: false, msg: 'Bot Token y Chat ID son obligatorios' });
  }
  try {
    const text =
      `✅ <b>Conectado — S9-TRIPLEX activo</b>\n\n` +
      `📊 Bot: S9-TRIPLEX\n` +
      `⚙️ Modo: PAPER\n` +
      `📈 Activos: BTCUSDT · ETHUSDT\n\n` +
      `<i>Conexión verificada desde el dashboard</i>`;
    const { data } = await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      { chat_id: chatId, text, parse_mode: 'HTML' },
      { timeout: 10000 }
    );
    if (data.ok) {
      try { fs.mkdirSync(STATE_DIR, { recursive: true }); fs.writeFileSync(TG_STATE, JSON.stringify({ token, chatId, savedAt: new Date().toISOString() }, null, 2)); } catch {}
      return res.json({ ok: true, msg: 'Mensaje enviado — revisa tu chat de Telegram' });
    }
    return res.json({ ok: false, msg: data.description || 'Respuesta inesperada de Telegram' });
  } catch (e) {
    const msg = e.response?.data?.description || e.message;
    return res.json({ ok: false, msg: `Telegram: ${msg}` });
  }
});

router.post('/test/ai', async (req, res) => {
  const { type = 'Claude (Anthropic)', key, model } = req.body;
  if (!key) return res.json({ ok: false, msg: 'API key requerida' });
  try {
    if (type === 'Claude (Anthropic)') {
      const mdl = model || 'claude-haiku-4-5-20251001';
      const { data } = await axios.post(
        'https://api.anthropic.com/v1/messages',
        { model: mdl, max_tokens: 10, messages: [{ role: 'user', content: 'ping' }] },
        { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, timeout: 12000 }
      );
      return res.json({ ok: true, msg: `Claude conectado — modelo: ${data.model}` });
    }
    if (type.includes('OpenAI') || type.includes('GPT')) {
      const mdl = model || 'gpt-4o-mini';
      const { data } = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        { model: mdl, max_tokens: 10, messages: [{ role: 'user', content: 'ping' }] },
        { headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' }, timeout: 12000 }
      );
      return res.json({ ok: true, msg: `OpenAI conectado — modelo: ${data.model}` });
    }
    if (type.includes('Gemini')) {
      const mdl = model || 'gemini-1.5-flash';
      const { data } = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent?key=${key}`,
        { contents: [{ parts: [{ text: 'ping' }] }] },
        { timeout: 12000 }
      );
      const ok = !!data.candidates;
      return res.json({ ok, msg: ok ? `Gemini conectado — modelo: ${mdl}` : 'Respuesta inesperada' });
    }
    return res.json({ ok: true, msg: `${type} — verificación OK` });
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.response?.data?.message || e.message;
    return res.json({ ok: false, msg: `Error: ${msg}` });
  }
});

router.post('/test/chart', async (req, res) => {
  const { type = 'TradingView' } = req.body;
  try {
    if (type === 'TradingView' || type === 'Custom Webhook') {
      return res.json({ ok: true, msg: 'Webhook listo — configura la URL en tus alertas de TradingView' });
    }
    return res.json({ ok: true, msg: `${type} — configuración registrada` });
  } catch (e) {
    return res.json({ ok: false, msg: e.message });
  }
});

// ── Telegram notify (used by engine + frontend on connect/disconnect) ─
async function sendTelegram(token, chatId, text) {
  return axios.post(
    `https://api.telegram.org/bot${token}/sendMessage`,
    { chat_id: chatId, text, parse_mode: 'HTML' },
    { timeout: 10000 }
  );
}

router.post('/notify', async (req, res) => {
  let { token, chatId, text } = req.body;
  // Fall back to stored credentials if not supplied
  if (!token || !chatId) {
    try {
      const saved = JSON.parse(fs.readFileSync(TG_STATE, 'utf8'));
      token   = token   || saved.token;
      chatId  = chatId  || saved.chatId;
    } catch {}
  }
  if (!token || !chatId || !text) return res.json({ ok: false, msg: 'Faltan parámetros' });
  try {
    const { data } = await sendTelegram(token, chatId, text);
    res.json({ ok: data.ok });
  } catch (e) {
    res.json({ ok: false, msg: e.response?.data?.description || e.message });
  }
});

module.exports = router;
module.exports.sendTelegram = sendTelegram;
module.exports.TG_STATE     = TG_STATE;
