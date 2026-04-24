# FONDO ALGORÍTMICO S9-TRIPLEX
## Informe Técnico del Proyecto Refundado

**Versión:** 2.0 (refactorización radical)
**Estrategia única:** S9 Triplex (AMT + PO3/SMT + Measured Move)
**Activos:** Futuros BTCUSDT + ETHUSDT (exclusivos)
**Modo:** STOP hasta validación visual integrada
**Runtime:** Node.js + Express GUI — independiente de Claude Code

---

## 1. INTRODUCCIÓN

Sistema de trading cuantitativo de confluencia triple para futuros de BTC y ETH en Binance. Refundado desde cero para eliminar dependencias innecesarias, código muerto, y cualquier acoplamiento con asistentes de IA en runtime. Claude queda relegado a herramienta de desarrollo; el sistema opera autónomo con `npm start`.

El proyecto reemplaza el stack anterior de 8 estrategias experimentales por una única estrategia validada estadísticamente antes de cualquier ejecución. Añade dos capas nuevas: GUI local para control operativo y validación visual final sobre TradingView antes de cada trade.

## 2. OBJETIVOS

**General:** operar S9 Triplex sobre BTC/ETH futuros con validación visual obligatoria, GUI autónoma, y criterios estadísticos no negociables.

**Específicos:**
- Ejecución exclusiva dentro de ventanas de liquidez institucional (Colombia)
- Análisis técnico puro, cero dependencia de noticias
- Dashboard local para control total sin terminal ni Claude Code
- Validación visual IA antes de cada orden
- Monte Carlo mínimo 1000 iteraciones integrado al backtest
- Capital real solo tras: WR > 40%, PF > 1.5, DD < 10%, n > 30 por activo/lado

**Metas cuantitativas (innegociables antes de capital real):**

| Métrica | Umbral |
|---------|--------|
| Win Rate | > 40% |
| Profit Factor | > 1.5 |
| Max Drawdown | < 10% |
| Sharpe | > 1.5 |
| Sortino | > 2.0 |
| Sample size | ≥ 30 por activo/lado |
| Paper trading | ≥ 60 días |
| Riesgo/trade | ≤ 0.5% (validación) — ≤ 2% (producción) |

## 3. MARCO TEÓRICO

### 3.1 Auction Market Theory (AMT) — Fabio Valentini
Mercados como subastas continuas. El precio busca equilibrio entre oferta y demanda. Elementos:
- **VAH / VAL:** límites del value area (70% del volumen diario)
- **POC:** precio de mayor volumen
- **LVN:** nodos de bajo volumen, aceleradores

### 3.2 Power of Three + SMT Divergence — Trader Kane
Tres fases repetidas en el precio:
1. **Accumulation** — rango lateral
2. **Manipulation** — barrido de liquidez
3. **Distribution** — regreso al 50% del rango

Confirmación por SMT Divergence entre BTC y ETH (activos correlacionados ~0.85): si BTC hace nuevo high/low pero ETH no, la manipulación está cediendo.

### 3.3 Measured Move — Marci Silfrain
"Little RZY": impulso + pullback con trendline. La distancia vertical low-a-trendline se proyecta 1:1 como objetivo. Bollinger Bands como contexto de exhaustión (primeros 1-2 RZY son los más fuertes).

### 3.4 Fusión en S9
Jerarquía de 5 tiers; todos deben pasar para emitir señal:

| Tier | Responsabilidad | Pertenece a |
|------|-----------------|-------------|
| 1 | Bias direccional (PO3 en D + H4) | Kane |
| 2 | Location (premium/discount + LVN) | Valentini |
| 3 | Timing (SMT divergence H1) | Kane |
| 4 | Confirmation (FVG + rejection + volumen 3m) | Kane + proxy AMT |
| 5 | Target + gestión (Measured Move + BB filter) | Silfrain |

## 4. ARQUITECTURA

### 4.1 Diagrama general

```
┌──────────────────────────────────────────────────┐
│              FUENTES DE DATOS                    │
│   Binance Futures API  │  TradingView Desktop    │
└────────┬──────────────────────┬──────────────────┘
         │                      │
         ▼                      ▼
┌──────────────────────────────────────────────────┐
│          MOTOR S9 (core/)                        │
│  indicators → tiers → signal → risk → executor   │
└────────┬──────────────────────┬──────────────────┘
         │                      │
         ▼                      ▼
┌──────────────────┐   ┌──────────────────────────┐
│  VALIDACIÓN      │   │  GUI LOCAL (Express)     │
│  VISUAL (IA)     │   │  start/stop, logs, P&L   │
│  sobre chart TV  │   │  config, módulos         │
└────────┬─────────┘   └──────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────┐
│    EJECUTOR (paper → real)                       │
│    Binance Futures  +  Telegram notify           │
└──────────────────────────────────────────────────┘
```

### 4.2 Flujo de decisión (obligatorio)

1. Motor detecta confluencia de los 5 tiers
2. Sistema verifica ventana horaria (si no, estado = OBSERVE)
3. Sistema captura gráfico de TradingView (BTC + ETH, timeframes S9)
4. Envía imagen + contexto numérico a IA para validación visual
5. IA responde APROBADO / RECHAZADO con razón
6. Solo si APROBADO → ejecutor coloca orden
7. Telegram notifica entry + P&L en tiempo real

**Validación visual es filtro final, no opcional.**

### 4.3 Ventanas de trading (COT)

| Ventana | Horario | Acción |
|---------|---------|--------|
| LDN/NY Overlap | 08:30 – 10:30 AM | Ejecutar |
| Asian Open | 07:00 – 09:00 PM | Ejecutar |
| Resto del día | Cualquier otro | Solo OBSERVE (análisis, no orden) |

El motor corre 24/7 detectando y logueando setups. Solo ejecuta dentro de ventanas.

### 4.4 Módulos del sistema

```
core/
  indicators.js    — EMA, ATR, Bollinger, SMA, RSI, volume profile
  regime.js        — detector ADX + EMA slope + volatilidad
  tier1-po3.js     — accumulation + manipulation
  tier2-amt.js     — premium/discount + LVN
  tier3-smt.js     — divergencia BTC/ETH
  tier4-confirm.js — FVG + rejection + aggression proxy
  tier5-risk.js    — SL/TP/BE/size
  signal.js        — orquestador de tiers

execution/
  paper.js         — simulador con slippage + fees
  binance.js       — ejecutor real (Binance Futures)
  webhook.js       — receptor de alertas TradingView

validation/
  visual.js        — captura chart + llama a IA de validación
  monte-carlo.js   — 1000 iteraciones bootstrap/shuffle

gui/
  server.js        — Express + static
  public/          — dashboard HTML/JS
  api.js           — endpoints REST + WebSocket

backtest/
  engine.js        — motor vectorizado 730d
  walk-forward.js  — train/validate/holdout
  reporter.js      — Excel + PNG equity curves

notify/
  telegram.js      — entry/exit/pnl/status

config/
  s9-rules.json    — parámetros estrategia
  .env             — secretos

state/
  trades.csv       — log operaciones S9
  equity.json      — curva de capital acumulada
  signals.log      — todos los setups detectados (ejecutados o no)

index.js           — entry point, arranca GUI + motor
```

## 5. STACK

| Componente | Versión | Rol |
|------------|---------|-----|
| Node.js | ≥ 20 | Runtime |
| Express | 4.x | GUI + webhook |
| axios | 1.x | HTTP a Binance/Telegram |
| ws | 8.x | WebSocket streaming |
| exceljs | 4.x | Reportes backtest |
| dotenv | 16.x | Variables entorno |

**Eliminado completamente:** RSS parsers, feeds de noticias, módulos de análisis fundamental, exchange BitGet, cualquier código relativo a S1–S8.

**Sin backend pesado, sin frameworks frontend grandes.** GUI en HTML/JS vanilla servido por Express.

## 6. ESTRATEGIA S9 (única)

Ver sección 3.4 para jerarquía. Parámetros concretos viven en `config/s9-rules.json`. No se documentan aquí para evitar duplicación; la fuente única de verdad es el JSON.

Resumen operativo:

- **Bias:** PO3 en D + H4 confirma LONG o SHORT
- **Location:** Precio en premium (>55%) para short / discount (<45%) para long del rango D1 previo
- **Timing:** SMT BTC/ETH en H1 confirma fin de manipulation
- **Confirmation:** FVG reactivado + vela rechazo (wick >60%) + volumen >1.3× SMA20 en 3m
- **Risk:** SL = extremo manipulation ± 0.1 ATR | TP = MIN(50% dealing range, Measured Move) | BE al 0.5R | Size × 0.5 si precio en banda Bollinger externa

## 7. GESTIÓN DE RIESGO

| Regla | Valor |
|-------|-------|
| Riesgo por trade (validación) | 0.5% equity |
| Riesgo por trade (producción) | 2% equity |
| Max posiciones simultáneas | 2 |
| Max exposición total | 4% equity |
| Max trades/día/símbolo | 3 |
| R:R mínimo | 2.0 (señal cancelada si <) |
| Trailing post TP1 | ATR × 2 |
| Time stop | 48h sin avance → cerrar |
| Kill switch | DD diario >5% → STOP |
| Correlación BTC/ETH >0.8 | Solo una posición abierta |

## 8. VALIDACIÓN VISUAL

Antes de enviar orden al exchange:

1. Sistema dispara `validation/visual.js`
2. Se captura screenshot del chart BTC en H1 + 3m + contexto ETH H1
3. Payload: imagen + datos numéricos de los 5 tiers + parámetros del trade propuesto
4. IA responde estructura JSON: `{approved: bool, reason: string, confidence: 0-1}`
5. Solo si `approved: true` y `confidence ≥ 0.6` → ejecutar

Este filtro atrapa casos donde el motor numérico ve confluencia pero el contexto gráfico lo desmiente (noticias visuales, gaps anormales, chart broken).

**Antes de producción real:** este módulo debe pasar 100 setups históricos en modo shadow para medir su tasa de falsos negativos.

## 9. VALIDACIÓN ESTADÍSTICA

### 9.1 Backtest
- Datos: Binance Futures 730 días (2 años mínimo — bull + bear + rebote)
- Split: 480d train / 180d validate / 70d holdout
- Walk-forward anchored, 24 folds, step 15d
- Slippage: 0.05% market / 0.02% limit
- Fees Binance Futures: 0.04% maker / 0.05% taker

### 9.2 Monte Carlo (mínimo 1000 iteraciones)
- Bootstrap de retornos
- Shuffle de orden de trades
- Reporte: distribución P&L, drawdown esperado percentiles 5/50/95, probabilidad de ruina
- Output embebido en reporte Excel y en dashboard GUI

### 9.3 Criterios de paso a paper
- Sharpe ≥ 1.5 (anualizado)
- PF ≥ 1.5
- DD < 10%
- Expectancy > 0.3R
- n ≥ 30 por activo/lado
- Estabilidad: métricas de train no degradan >30% en validate

### 9.4 Criterios de paso a capital real
- 60 días paper en vivo cumpliendo métricas
- Monte Carlo muestra probabilidad de ruina <5%
- Validación visual acierto ≥90% en shadow testing

## 10. GUI LOCAL

Dashboard web accesible en `http://127.0.0.1:8080`:

- **Estado:** motor ON/OFF, modo (OBSERVE/LIVE/BACKTEST), ventana activa
- **Botones:** start, stop, pause, kill-switch
- **Posiciones abiertas:** tabla live con P&L USD + %
- **Logs:** stream en tiempo real (niveles: error/warn/info)
- **Configuración:** editor de `s9-rules.json` con validación de schema
- **Módulos:** toggles para validación visual, Monte Carlo, Telegram
- **Reportes:** descarga de Excel del último backtest y equity curve
- **Monte Carlo preview:** histograma P&L + DD esperado

Arranca con `npm start`. **Cero dependencia de Claude Code.** Claude solo se usa para desarrollo/debugging por el humano; el sistema no lo invoca.

## 11. TELEGRAM

Notificaciones obligatorias:

| Evento | Contenido |
|--------|-----------|
| Arranque sistema | Modo, versión, hora COT |
| Señal detectada | Tiers pasados, símbolo, lado |
| Validación visual | Resultado IA + razón |
| Entry ejecutado | Symbol, side, entry, SL, TP, size |
| Trailing / BE | Nivel actualizado |
| Exit | Resultado USD + %, razón (SL/TP/BE/manual/time) |
| Heartbeat | Cada 4h ("alive") |
| Kill switch | Motivo + posiciones afectadas |

**Todo P&L se reporta simultáneamente en USD y %.** Todo timestamp en hora Colombia.

## 12. ROADMAP

| Fase | Duración | Entregable |
|------|----------|------------|
| F1 — Migración | 3–5 días | Estructura limpia `s9-fondo/`, código esencial migrado, tests unitarios pasando |
| F2 — Motor S9 modular | 5–7 días | core/ completo, señal generándose en logs (sin ejecutar) |
| F3 — Backtest + MC | 3–5 días | Backtest 730d + Monte Carlo 1000 iter + reporte |
| F4 — GUI | 3–4 días | Dashboard funcional, config editable, start/stop |
| F5 — Validación visual | 2–3 días | Módulo captura + IA + shadow testing 100 setups |
| F6 — Paper 60d | 60 días | Operación paper cumpliendo métricas |
| F7 — Capital micro | 30 días | $200 real con 0.5% risk |
| F8 — Escalamiento | continuo | $1K → $10K en ciclos de 30d rentables |

## 13. REGLAS INNEGOCIABLES

1. STOP obligatorio hasta F5 completa
2. Ningún trade sin validación visual aprobada
3. Solo BTC y ETH futuros
4. Solo dentro de ventanas COT definidas
5. Cero noticias, cero RSS, cero fundamental
6. Max 2% riesgo/trade (0.5% en validación)
7. Paper → capital solo con métricas cumplidas
8. Sistema autónomo: `npm start` y funciona
9. Documentación como fuente única de verdad — el código cumple el doc
10. Honestidad radical sobre métricas

## 14. LECCIONES APLICADAS

- Eliminar complejidad antes de añadirla ("cero grasa")
- Fuente única de verdad en config JSON
- Aislamiento de módulos para que un fallo no tumbe el sistema
- Validación visual captura lo que los números no ven
- Monte Carlo revela fragilidad invisible en backtest simple
- Independencia total de Claude en runtime

---

**Fin Informe 1 — Proyecto refundado, listo para migración.**