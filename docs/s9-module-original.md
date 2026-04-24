# s9-module — Estrategia S9 Triplex

Módulo independiente para la estrategia **S9 Triplex**: confluencia de tres metodologías aplicadas a crypto en Binance Futures.

> **Estado:** Fase 2A completada (infraestructura). Fase 2B pendiente (Pine Script). **Paper trading only** hasta validación completa.

---

## Arquitectura

El módulo corre en proceso **separado** del `bot.js` principal:

```
claude-tradingview-mcp-trading/
├── bot.js               ← Motor principal (S1, S4) — NO TOCAR
├── rules.json           ← S4 RSI(3) 20/80 — NO TOCAR
├── trades.csv           ← Log de S1/S4 — NO TOCAR
│
└── s9-module/           ← Este módulo (aislado)
    ├── package.json     ← Dependencias propias
    ├── s9-rules.json    ← Parámetros S9
    ├── .env             ← Secretos (no en git)
    ├── node_modules/    ← Aislado del bot principal
    ├── s9-pine/         ← Pine Script v6 (Fase 2B)
    ├── logs/            ← Logs runtime
    ├── data/            ← Caches, históricos descargados
    ├── tests/           ← Unit tests (Fase 5+)
    └── trades_s9.csv    ← Log S9 (se crea en Fase 2D)
```

**Principio:** cero acoplamiento. Si S9 crashea, S1/S4 siguen corriendo. Si bot.js falla, S9 sigue su propio ciclo.

---

## Estrategias fusionadas

| Componente | Autor | Aporte |
|---|---|---|
| AMT (Auction Market Theory) | Fabio Valentini | Market State + Location (VAH/VAL/POC/LVN) |
| PO3 + SMT Divergence | Trader Kane | Bias direccional + timing de entrada |
| Measured Move | Marci Silfrain | TP proyectado + filtro Bollinger exhaustión |

Los parámetros numéricos viven en `s9-rules.json`. Cada cambio de parámetro requiere un nuevo backtest (Fase 2C).

---

## Componentes (por fase)

### Fase 2A — Infraestructura ✅
- Estructura de carpetas
- `package.json` con dependencias aisladas
- `s9-rules.json` con parámetros iniciales
- `.gitignore` y `.env.example`

### Fase 2B — Pine Script + webhook server (pendiente)
- `s9-pine/S9_Triplex_BTC.pine` — indicator con alertcondition()
- `s9-webhook-server.js` — Express en puerto 3001

### Fase 2C — Backtester (pendiente)
- `s9-backtest.js` — replica lógica en JS, consume Binance 365 días
- Output: JSON de trades + métricas (n, WR, PF, DD)

### Fase 2D — Ejecutor paper (pendiente)
- `s9-executor.js` — trades virtuales al recibir webhook
- Logging en `trades_s9.csv`
- Notificaciones Telegram

---

## Ejecución (cuando Fase 2B esté listo)

```powershell
cd s9-module

# Instalar dependencias
npm install

# Crear .env desde template
Copy-Item .env.example .env
# Editar .env con valores reales

# Arrancar servidor webhook
npm start

# O en modo desarrollo (auto-restart on change)
npm run start:dev

# Ejecutar backtest (Fase 2C)
npm run backtest
```

---

## Variables de entorno (`.env`)

Ver `.env.example` para lista completa. Variables críticas:

- `S9_MODE` — `PAPER` (default) o `LIVE` (solo tras validación)
- `S9_WEBHOOK_PORT` — 3001
- `S9_WEBHOOK_SECRET` — autenticación del webhook (shared secret)
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — notificaciones
- `BINANCE_API_KEY` / `BINANCE_API_SECRET` — para backtests y fallback

---

## Métricas objetivo (innegociables)

Antes de considerar capital real, S9 debe demostrar en paper:

- **n > 30** trades por símbolo
- **Win rate > 40%**
- **Profit factor > 1.5**
- **Max drawdown < 10%**
- Mínimo **60 días** de paper trading

Métricas por debajo → iterar parámetros en `s9-rules.json`, rebacktestear, repetir.

---

## Reglas innegociables (heredadas del fondo)

1. Paper trading hasta validación completa
2. Riesgo máximo 0.5% por trade (hasta validación; luego hasta 2%)
3. Respuestas de sistema siempre en español, hora Colombia, P&L en USD
4. Verificar compatibilidad antes de pagar servicios
5. BTC y ETH en producción; SOL y BNB solo en observación (correlación insuficiente para SMT)

---

## Limitaciones conocidas

- **Sin footprint real:** Essential TV no lo provee. Usamos Volume Profile nativo + proxies (delta aproximado, volumen relativo, wicks de rechazo)
- **SMT limitado a BTC/ETH:** correlación con SOL/BNB insuficiente para producción
- **Pine Script no ejecuta:** solo detecta y alerta. Ejecución es responsabilidad de bot.js/s9-executor
- **Trial TV 30 días:** si no se renueva, fallback automático a consumir Binance API directo desde `s9-executor`

---

## Rama git

Todo el desarrollo S9 vive en la rama `s9-triplex`. `main` queda intacta con S1/S4.

```powershell
git checkout s9-triplex    # trabajar en S9
git checkout main          # volver a S1/S4
```

Merge a main solo cuando Fase 2D complete 60 días paper con métricas objetivo.

---

## Contacto

**Propietario:** Boris (thebronson97@gmail.com)  
**Supervisor del fondo:** Boris  
**Diseñador algorítmico:** CEO Algorítmico (Claude claude.ai)  
**Ejecutor local:** Claude Code 2.1.112 en Windows 11
