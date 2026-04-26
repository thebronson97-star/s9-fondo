'use strict';
// notify/telegram.js — Notificaciones Telegram para S9
require('dotenv').config();
const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

const TG_STATE = path.join(__dirname, '..', 'state', 'telegram.json');

function getCreds() {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (token && chatId) return { token, chatId };
  try {
    const saved = JSON.parse(fs.readFileSync(TG_STATE, 'utf8'));
    if (saved.token && saved.chatId) return { token: saved.token, chatId: saved.chatId };
  } catch {}
  return null;
}

function colTime() {
  const d = new Date(Date.now() - 5 * 3600000);
  const dd   = String(d.getUTCDate()).padStart(2, '0');
  const mo   = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  const hh   = String(d.getUTCHours()).padStart(2, '0');
  const mm   = String(d.getUTCMinutes()).padStart(2, '0');
  const ss   = String(d.getUTCSeconds()).padStart(2, '0');
  return `${dd}/${mo}/${yyyy}, ${hh}:${mm}:${ss} (COL UTC-5)`;
}

async function send(text) {
  const creds = getCreds();
  if (!creds) return;
  try {
    await axios.post(`https://api.telegram.org/bot${creds.token}/sendMessage`, {
      chat_id: creds.chatId,
      text,
      parse_mode: 'HTML',
    }, { timeout: 5000 });
  } catch (e) {
    process.stderr.write(`[TG_ERR] ${e.message}\n`);
  }
}

const tg = {
  start: (mode, ver) =>
    send(`<b>[S9] ARRANCADO</b>\nModo: ${mode} | v${ver}\n${colTime()}`),

  signal: (r) =>
    send(`<b>[S9] SEÑAL: ${r.side} ${r.symbol}</b>\nR:R=${r.trade?.rr}\nRazon: ${r.reason}\n${colTime()}`),

  entry: (t) => {
    const strat    = t.strategy || 'Manual';
    const isLong   = t.side === 'LONG';
    const entry    = parseFloat(t.entry);
    const size     = parseFloat(t.size);
    const sizeUSD  = (entry * size).toFixed(2);
    const sizeAsset = size.toFixed(6);
    const sym      = t.symbol || '';
    const asset    = sym.replace('USDT', '');
    const mode     = t.mode || 'PAPER';
    const orderId  = mode === 'LIVE' ? (t.binanceOrderId || t.id || '—') : `PAPER-${t.id || Date.now()}`;
    const modeNote = mode === 'LIVE' ? 'REAL — orden ejecutada en Binance' : 'PAPER — ninguna orden real fue colocada';

    let slLine = '';
    if (t.sl != null) {
      const sl       = parseFloat(t.sl);
      const riskUSD  = isLong ? (entry - sl) * size : (sl - entry) * size;
      const riskPct  = (Math.abs(entry - sl) / entry * 100).toFixed(1);
      const sign     = isLong ? '-' : '+';
      slLine = `\nStop Loss: $${sl.toFixed(2)} (${sign}$${riskUSD.toFixed(2)}, ${riskPct}%)`;
    }

    let tpLine = '';
    if (t.tp != null) {
      const tp        = parseFloat(t.tp);
      const profitUSD = isLong ? (tp - entry) * size : (entry - tp) * size;
      const profitPct = (Math.abs(tp - entry) / entry * 100).toFixed(1);
      const sign      = isLong ? '+' : '-';
      tpLine = `\nTake Profit: $${tp.toFixed(2)} (${sign}$${profitUSD.toFixed(2)}, ${profitPct}%)`;
    }

    return send(
      `📊 <b>Fondo Trading Bot</b>\n\n` +
      `Estrategia: ${strat}\n` +
      `Dirección: ${t.side}\n\n` +
      `Entrada: $${entry.toFixed(2)}` +
      slLine +
      tpLine + '\n\n' +
      `Tamaño: $${sizeUSD} (${sizeAsset} ${asset})\n\n` +
      `ID Orden: ${orderId}\n\n` +
      `Modo: ${modeNote}\n\n` +
      colTime()
    );
  },

  exit: (t, pnlUSD, pnlPct, reason) =>
    send(`<b>[S9] EXIT ${t.side} ${t.symbol}</b>\nP&amp;L: ${pnlUSD >= 0 ? '+' : ''}$${pnlUSD.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)\nRazon: ${reason}\n${colTime()}`),

  killSwitch: (reason) =>
    send(`<b>[S9] KILL SWITCH</b>\n${reason}\n${colTime()}`),

  heartbeat: (s) =>
    send(`[S9] ALIVE | Modo: ${s.mode} | PnL hoy: $${(s.dailyPnL ?? 0).toFixed(2)} | Ticks: ${s.loopCount}\n${colTime()}`),

  error: (msg) =>
    send(`<b>[S9] ERROR</b>\n${msg}\n${colTime()}`),
};

module.exports = tg;
