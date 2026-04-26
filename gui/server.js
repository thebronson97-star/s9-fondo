'use strict';
// gui/server.js — Express HTTP + WebSocket dashboard
require('dotenv').config();
const http    = require('http');
const path    = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const engine  = require('../core/engine');

const PORT = parseInt(process.env.GUI_PORT  ?? '8080');
const HOST =          process.env.GUI_HOST  ?? '127.0.0.1';

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());

// Serve index.html with injected build-stamp so JSX scripts are never cached
const BUILD = Date.now();
app.get('/', (_req, res) => {
  const html = require('fs').readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8')
    .replace('tweaks-panel.jsx">', `tweaks-panel.jsx?v=${BUILD}">`)
    .replace('fondo-sections.jsx">', `fondo-sections.jsx?v=${BUILD}">`);
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-store');
  res.send(html);
});

app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders(res) { res.setHeader('Cache-Control', 'no-store'); },
}));
app.use('/api', require('./api'));

// ── WebSocket broadcast ───────────────────────────────────────
function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

wss.on('connection', (ws) => {
  // Send current state on connect
  ws.send(JSON.stringify({ type: 'state', state: engine.getState() }));
});

// ── Wire engine events to WS clients ─────────────────────────
function wireEvents() {
  if (!global.guiEmitter) return;
  global.guiEmitter.on('log',       d => broadcast({ type: 'log',       ...d }));
  global.guiEmitter.on('signal',    d => broadcast({ type: 'signal',    ...d }));
  global.guiEmitter.on('positions', d => broadcast({ type: 'positions', positions: d }));
  global.guiEmitter.on('state',     d => broadcast({ type: 'state',     state: { ...engine.getState(), ...d } }));
}

// ── State push every 5 s ──────────────────────────────────────
let stateTimer = null;

async function start() {
  return new Promise((resolve, reject) => {
    server.listen(PORT, HOST, () => {
      engine.log(`GUI → http://${HOST}:${PORT}`);
      wireEvents();
      stateTimer = setInterval(
        () => broadcast({ type: 'state', state: engine.getState() }),
        5000,
      );
      resolve();
    });
    server.on('error', reject);
  });
}

function stop() {
  clearInterval(stateTimer);
  wss.close();
  server.close();
}

module.exports = { start, stop, broadcast };
