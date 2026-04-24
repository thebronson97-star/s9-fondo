# ESTRUCTURA LIMPIA DEL PROYECTO `s9-fondo/`

Lista exacta y mínima. Todo lo que no esté aquí, no existe.

```
C:\Users\BORISS\s9-fondo\
│
├── index.js                          # Entry point: arranca GUI + motor
├── package.json
├── package-lock.json
├── .env                              # Secretos (no en git)
├── .env.example                      # Template del .env
├── .gitignore
├── README.md                         # Cómo arrancar y operar
│
├── config\
│   └── s9-rules.json                 # Parámetros S9 (fuente única de verdad)
│
├── core\                             # Motor S9 modular
│   ├── indicators.js                 # EMA, ATR, Bollinger, SMA, RSI, volume profile
│   ├── regime.js                     # ADX + EMA slope + volatilidad
│   ├── tier1-po3.js                  # Accumulation + manipulation
│   ├── tier2-amt.js                  # Premium/discount + LVN
│   ├── tier3-smt.js                  # SMT BTC/ETH
│   ├── tier4-confirm.js              # FVG + rejection + aggression proxy
│   ├── tier5-risk.js                 # SL/TP/BE/size
│   ├── signal.js                     # Orquestador: une los 5 tiers
│   ├── windows.js                    # Ventanas COT (LDN/NY, Asia)
│   └── engine.js                     # Loop principal del motor
│
├── execution\
│   ├── paper.js                      # Simulador con slippage + fees
│   ├── binance.js                    # Ejecutor Binance Futures
│   └── router.js                     # Enruta según MODE (paper/live)
│
├── validation\
│   ├── visual.js                     # Captura TV + validación IA
│   ├── monte-carlo.js                # 1000+ iteraciones
│   └── schema.js                     # Valida s9-rules.json
│
├── gui\
│   ├── server.js                     # Express + WebSocket
│   ├── api.js                        # Endpoints REST
│   └── public\
│       ├── index.html                # Dashboard
│       ├── app.js                    # Frontend vanilla JS
│       └── style.css
│
├── backtest\
│   ├── engine.js                     # Motor vectorizado 730d
│   ├── walk-forward.js               # Train/validate/holdout
│   ├── data-fetcher.js               # Descarga histórico Binance
│   └── reporter.js                   # Excel + PNG equity
│
├── notify\
│   └── telegram.js                   # Entry/exit/P&L/heartbeat
│
├── scripts\
│   ├── migrate-from-legacy.ps1       # Migración desde proyecto antiguo
│   └── install-service.ps1           # (Opcional) registrar como servicio Windows
│
├── state\                            # Generado en runtime (no en git)
│   ├── trades.csv                    # Log operaciones S9
│   ├── equity.json                   # Curva de capital
│   ├── signals.log                   # Todos los setups detectados
│   └── legacy-trades-archive.csv     # Histórico S1/S4 rescatado (solo lectura)
│
├── logs\                             # Generado en runtime (no en git)
│   └── s9.log
│
├── docs\
│   ├── INFORME_1_PROYECTO_COMPLETO.md
│   ├── INFORME_2_ESTADO_ACTUAL_COMANDOS.md
│   ├── MIGRACION.md                  # Guía de migración
│   └── s9-module-original.md         # README original del s9-module migrado
│
└── node_modules\                     # Generado por npm (no en git)
```

## Totales

| Categoría | Cantidad | Notas |
|-----------|----------|-------|
| Archivos de código | 22 | Contando cada `.js` del sistema |
| Archivos de config | 4 | package.json, .env, .env.example, s9-rules.json |
| Carpetas | 11 | Incluyendo `state/` y `logs/` generadas en runtime |
| Docs | 4 | Informes + migración + legacy |

## Comparación con proyecto antiguo

| Métrica | Antiguo | Nuevo | Reducción |
|---------|---------|-------|-----------|
| Archivos `.js` principales | ~25 | 22 | Similar, pero con responsabilidades claras |
| Estrategias activas | 8 (S1–S8) | 1 (S9) | 87% menos |
| Archivos `rules-*.json` | 6 | 1 | 83% menos |
| Backtests sueltos | 6 | 1 motor unificado | 83% menos |
| Dependencias npm | 8+ | 5 | 40% menos |
| Acoplamiento con Claude Code | Alto | Cero | — |
| Módulos de noticias/RSS | 3 | 0 | Eliminado |
| Puntos de entrada | 3 (bot.js, report.js, backtest-*.js) | 1 (`npm start`) | — |

## Archivos que NO existen (eliminados)

Listado explícito de lo que **no** debe aparecer en el nuevo proyecto:

- `bot.js` (del proyecto viejo — contiene S1/S4)
- `rules-2.json`, `rules-3.json`, `rules-4.json`, `rules-5.json`, `rules-6.json`
- `backtest-v3.js`, `backtest-v4.js`, `backtest-improved.js`, `backtest-macd-ema.js`
- `report.js` (del proyecto viejo — se reescribe en `backtest/reporter.js`)
- `feeds/`, `rss-parser.js`, cualquier módulo de noticias
- `.claude/commands/` (los slash commands quedan en el proyecto viejo si se necesitan históricamente)
- `s9-module/` como carpeta (su contenido migra a `config/` y `docs/`)

## Fuente única de verdad por tema

| Tema | Archivo |
|------|---------|
| Parámetros de estrategia | `config/s9-rules.json` |
| Credenciales | `.env` |
| Lógica de cada tier | `core/tierN-*.js` |
| Arquitectura | `docs/INFORME_1_PROYECTO_COMPLETO.md` |
| Comandos operativos | `docs/INFORME_2_ESTADO_ACTUAL_COMANDOS.md` |
| Estado runtime | `state/` |

---

**Estructura congelada.** Cualquier archivo fuera de esta lista es deuda técnica y debe justificarse o eliminarse.