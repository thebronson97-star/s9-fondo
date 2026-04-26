'use strict';
// plugin-loader.js — Carga estrategias desde archivos o código en tiempo real
// No contiene lógica de estrategia. Solo el sistema de carga/ejecución.

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

// ── Estado ────────────────────────────────────────────────────
let currentStrategy = null;
let strategySource  = null; // Código fuente para debug

// ── Cargar estrategia desde archivo ───────────────────────────
function loadFromFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `Archivo no encontrado: ${filePath}` };
    }
    const code = fs.readFileSync(filePath, 'utf8');
    return loadFromCode(code, filePath);
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── Cargar estrategia desde código (string) ───────────────────
// Esta es la función que usará la UI cuando pegues código
function loadFromCode(code, name = 'user-strategy') {
  try {
    // Validar que el código tiene la estructura mínima
    if (!code.includes('evaluate') || !code.includes('module.exports')) {
      return {
        success: false,
        error: 'El código debe exportar una función evaluate() via module.exports'
      };
    }

    // Crear contexto seguro
    const context = {
      require,
      module: { exports: {} },
      console,
      Math,
      Date,
      JSON,
      Array,
      Object,
      Number,
      String,
      Boolean,
      parseFloat,
      parseInt,
      isNaN,
      isFinite,
      setTimeout,
      clearTimeout,
    };

    // Ejecutar código en sandbox
    vm.createContext(context);
    vm.runInContext(code, context, { timeout: 5000, filename: name });

    const strategy = context.module.exports;

    // Validar interfaz
    if (typeof strategy.evaluate !== 'function') {
      return { success: false, error: 'La estrategia debe exportar evaluate(data)' };
    }

    currentStrategy = strategy;
    strategySource = code;

    return {
      success: true,
      strategy: {
        name: strategy.name || name,
        version: strategy.version || '1.0.0',
        timeframes: strategy.timeframes || ['1h'],
        description: strategy.description || 'Sin descripción',
      }
    };
  } catch (e) {
    return { success: false, error: `Error compilando estrategia: ${e.message}` };
  }
}

// ── Evaluar estrategia cargada ────────────────────────────────
function evaluate(marketData) {
  if (!currentStrategy) {
    return {
      pass: false,
      reason: 'NO_STRATEGY_LOADED',
      message: 'No hay estrategia cargada. Inserta una desde Configuración.'
    };
  }

  try {
    const result = currentStrategy.evaluate(marketData);

    // Normalizar resultado
    return {
      pass: Boolean(result.pass),
      side: result.side || null,
      symbol: result.symbol || null,
      entry: result.entry || null,
      sl: result.sl || null,
      tp: result.tp || null,
      size: result.size || null,
      rr: result.rr || null,
      confidence: result.confidence || 0,
      reason: result.reason || 'strategy_evaluated',
      metadata: result.metadata || {},
    };
  } catch (e) {
    return {
      pass: false,
      reason: 'STRATEGY_ERROR',
      message: e.message,
    };
  }
}

// ── Verificar si hay estrategia cargada ───────────────────────
function isLoaded() {
  return currentStrategy !== null;
}

// ── Obtener info de estrategia actual ─────────────────────────
function getInfo() {
  if (!currentStrategy) return null;
  return {
    name: currentStrategy.name || 'unnamed',
    version: currentStrategy.version || 'unknown',
    timeframes: currentStrategy.timeframes || [],
    description: currentStrategy.description || '',
  };
}

// ── Descargar estrategia ──────────────────────────────────────
function unload() {
  currentStrategy = null;
  strategySource = null;
  return { success: true };
}

// ── Guardar estrategia en archivo ─────────────────────────────
function saveToFile(code, filename = 'strategy.js') {
  try {
    const dir = path.join(__dirname, '..', 'strategies');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, code, 'utf8');
    return { success: true, path: filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── Listar estrategias guardadas ──────────────────────────────
function listSaved() {
  try {
    const dir = path.join(__dirname, '..', 'strategies');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.js'))
      .map(f => ({ name: f, path: path.join(dir, f) }));
  } catch {
    return [];
  }
}

// ── Export ────────────────────────────────────────────────────
module.exports = {
  loadFromFile,
  loadFromCode,
  evaluate,
  isLoaded,
  getInfo,
  unload,
  saveToFile,
  listSaved,
};
