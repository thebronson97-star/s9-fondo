'use strict';
// execution/router.js — Paper recorder + LIVE stub
const fs   = require('fs');
const path = require('path');
const tg   = require('../notify/telegram');

const tradesFile = path.join(__dirname, '..', 'trades_s9.csv');

const CSV_HEADER = 'ts,symbol,side,entry,sl,tp,be,rr,size,riskUSD\n';

function ensureHeader() {
  if (!fs.existsSync(tradesFile)) {
    fs.writeFileSync(tradesFile, CSV_HEADER);
  }
}

async function execute(trade, state, tiers = {}) {
  // ── Validación visual (filtro final antes de cualquier ejecución) ──
  if (process.env.AI_VALIDATION_ENABLED === 'true') {
    const visual = require('../validation/visual');
    const vr = await visual.validate(trade, tiers);
    const tag = vr.approved ? 'APROBADA' : 'RECHAZADA';
    process.stdout.write(`[ROUTER] Validación visual ${tag} | conf=${vr.confidence} | ${vr.reason}\n`);
    if (global.guiEmit) global.guiEmit('log', { level: vr.approved ? 'info' : 'warn', msg: `Validación visual ${tag}: ${vr.reason}` });
    tg.error(`Validación ${tag} (conf=${vr.confidence}): ${vr.reason}`);
    if (!vr.approved) return { ok: false, reason: 'visual_rejected', validation: vr };
  }

  if (state.mode === 'PAPER') {
    ensureHeader();
    const line = [
      new Date().toISOString(),
      trade.symbol, trade.side,
      trade.entry, trade.sl, trade.tp, trade.be,
      trade.rr, trade.size, trade.riskUSD,
    ].join(',') + '\n';
    try { fs.appendFileSync(tradesFile, line); } catch {}
    let pos;
    try { pos = require('../core/engine').openPosition(trade, 'AUTO'); } catch {}
    tg.entry({ ...trade, id: pos?.id, strategy: trade.strategy || 'S9-Triplex', mode: state.mode });
    return { ok: true, mode: 'PAPER', trade };
  }

  if (state.mode === 'LIVE') {
    const live = require('./live');
    const orders = await live.placeOrder(trade);
    let pos;
    try { pos = require('../core/engine').openPosition(trade, 'LIVE'); } catch {}
    tg.entry({ ...trade, id: pos?.id, strategy: trade.strategy || 'S9-Triplex', mode: state.mode });
    return { ok: true, mode: 'LIVE', trade, orders };
  }
}

module.exports = { execute };
