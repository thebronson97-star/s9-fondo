'use strict';
// index.js — Entry point: arranca GUI + motor
require('dotenv').config();

const engine = require('./core/engine');
const gui    = require('./gui/server');

// Expose engine log to GUI via global emitter
const { EventEmitter } = require('events');
global.guiEmitter = new EventEmitter();
global.guiEmit = (event, data) => global.guiEmitter.emit(event, data);

async function main() {
  console.log('[S9-FONDO] Iniciando...');
  console.log(`[S9-FONDO] MODE=${process.env.MODE ?? 'STOP'}`);
  console.log(`[S9-FONDO] NODE=${process.version}`);

  // Start GUI first (so dashboard is ready)
  await gui.start();

  // Start engine (respects MODE from .env)
  if ((process.env.MODE ?? 'STOP') !== 'STOP') {
    engine.start();
  } else {
    engine.log('Mode=STOP — motor en espera. Usa la GUI para cambiar modo.');
  }

  // Graceful shutdown
  process.on('SIGINT',  shutdown);
  process.on('SIGTERM', shutdown);
}

function shutdown() {
  console.log('\n[S9-FONDO] Shutting down...');
  engine.stop();
  process.exit(0);
}

main().catch(err => {
  console.error('[S9-FONDO] Fatal error:', err);
  process.exit(1);
});
