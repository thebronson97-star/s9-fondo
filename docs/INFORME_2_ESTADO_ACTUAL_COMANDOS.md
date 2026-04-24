# S9-TRIPLEX — ESTADO ACTUAL Y COMANDOS

**Versión:** 2.0 refundado
**Directorio nuevo:** `C:\Users\BORISS\s9-fondo\`
**Directorio antiguo (a eliminar tras migrar):** `C:\Users\BORISS\claude-tradingview-mcp-trading\`
**Runtime:** `npm start` — sin Claude Code, sin terminal interactiva

---

## 1. ESTADO ACTUAL

- **Bot legacy (S1/S4):** DESACTIVADO. Task Scheduler deshabilitado.
- **Modo actual del nuevo sistema:** STOP (no ejecuta trades hasta F5 completa)
- **Estrategia única:** S9 Triplex
- **Activos:** BTCUSDT + ETHUSDT (futuros perpetuos Binance)

## 2. SETUP INICIAL DESDE CERO

### 2.1 Prerrequisitos

```powershell
node --version   # >= 20.0
git --version    # >= 2.30
```

### 2.2 Crear carpeta del nuevo proyecto

```powershell
cd C:\Users\BORISS
mkdir s9-fondo
cd s9-fondo
git init
npm init -y
```

### 2.3 Instalar dependencias mínimas

```powershell
npm install express axios ws dotenv exceljs
npm install --save-dev nodemon
```

### 2.4 Crear estructura inicial

```powershell
New-Item -ItemType Directory -Force -Path core, execution, validation, gui, gui\public, backtest, notify, config, state, logs, scripts
```

### 2.5 Configurar `.env`

```powershell
notepad .env
```

Contenido mínimo:

```
BINANCE_API_KEY=...
BINANCE_API_SECRET=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=815415621
MODE=STOP
GUI_PORT=8080
GUI_HOST=127.0.0.1
```

### 2.6 Configurar `.gitignore`

```powershell
@"
node_modules/
.env
state/
logs/
*.log
*.xlsx
"@ | Out-File -FilePath .gitignore -Encoding utf8
```

## 3. MIGRACIÓN DESDE PROYECTO ANTIGUO

### 3.1 Copiar solo lo esencial

Desde el proyecto antiguo, solo se rescata:

```powershell
$old = "C:\Users\BORISS\claude-tradingview-mcp-trading"
$new = "C:\Users\BORISS\s9-fondo"

# Rescatar s9-module tal cual
Copy-Item "$old\s9-module\s9-rules.json" "$new\config\s9-rules.json"
Copy-Item "$old\s9-module\README.md"     "$new\docs\s9-module-original.md" -Force

# Conservar historial de trades para análisis (solo lectura, no operación)
Copy-Item "$old\trades.csv" "$new\state\legacy-trades-archive.csv"
```

### 3.2 NO migrar

Todo lo demás queda en el proyecto antiguo. Específicamente **no migrar**:
- `bot.js` (contiene S1/S4)
- `rules-2.json` a `rules-6.json`
- `backtest.js`, `backtest-wfa.js`, `backtest-v3.js`, `backtest-v4.js`, `backtest-improved.js`, `backtest-macd-ema.js`
- `report.js` (se reescribe dentro del nuevo sistema)
- RSS feeds, noticias, agentes Claude Code
- Subagentes (se mantienen en `~/.claude/agents/` porque son globales del usuario, pero no participan del runtime)

### 3.3 Archivar proyecto antiguo

```powershell
# Último backup antes de eliminar
$stamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
robocopy $old "C:\Users\BORISS\Backups\legacy-archive_$stamp" /E /XD node_modules /NFL /NDL /NJH /NJS

# Deshabilitar tarea programada del bot antiguo
Disable-ScheduledTask -TaskName "TradingBot"

# (Opcional) eliminar Task Scheduler del bot antiguo
Unregister-ScheduledTask -TaskName "TradingBot" -Confirm:$false
```

**No borrar aún la carpeta del proyecto antiguo.** Mantener 30 días por si se necesita recuperar algo.

## 4. OPERACIÓN DIARIA

### 4.1 Arrancar el sistema (GUI + motor)

```powershell
cd C:\Users\BORISS\s9-fondo
npm start
```

Abre navegador en `http://127.0.0.1:8080`. Toda la operación se hace desde ahí:
- Cambiar modo: STOP / OBSERVE / PAPER / LIVE
- Start / Stop / Pause del motor
- Ver posiciones abiertas con P&L en tiempo real
- Ver logs stream
- Editar `s9-rules.json` con validación de schema
- Descargar reportes Excel
- Ver histograma Monte Carlo

### 4.2 Modo desarrollo (auto-reload)

```powershell
npm run dev
```

### 4.3 Ejecutar backtest completo

Desde la GUI: botón "Run Backtest 730d". O por CLI:

```powershell
npm run backtest
```

Output: `state/backtest-YYYYMMDD.xlsx` + equity curve PNG.

### 4.4 Monte Carlo standalone

```powershell
npm run montecarlo -- --iterations=1000 --input state/backtest-YYYYMMDD.json
```

### 4.5 Ver logs sin GUI

```powershell
Get-Content logs\s9.log -Tail 50 -Wait
```

## 5. VERIFICACIÓN DE SALUD

### 5.1 Health check del sistema

```powershell
Invoke-RestMethod http://127.0.0.1:8080/api/health
```

Respuesta esperada:

```json
{"status":"alive","mode":"STOP","uptime_s":123,"time_col":"..."}
```

### 5.2 Conectividad externa

```powershell
Invoke-RestMethod "https://fapi.binance.com/fapi/v1/ping"
Invoke-RestMethod "https://api.telegram.org/bot$env:TELEGRAM_BOT_TOKEN/getMe"
```

### 5.3 Estado del motor

```powershell
Invoke-RestMethod http://127.0.0.1:8080/api/status
```

Respuesta: modo actual, ventana de trading activa, señales detectadas hoy, P&L acumulado.

### 5.4 Verificar que el bot antiguo NO corra

```powershell
Get-ScheduledTask -TaskName "TradingBot" -ErrorAction SilentlyContinue | Select-Object State
# Esperado: Disabled o el task no existe
Get-Process node -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -like "*claude-tradingview-mcp-trading*" }
# Esperado: vacío
```

## 6. CONTROL DEL MOTOR (CLI opcional)

La GUI es la interfaz primaria. Para control programático:

```powershell
# Cambiar a OBSERVE
Invoke-RestMethod -Method Post http://127.0.0.1:8080/api/mode -Body (@{mode="OBSERVE"} | ConvertTo-Json) -ContentType "application/json"

# Pausar
Invoke-RestMethod -Method Post http://127.0.0.1:8080/api/pause

# Kill switch
Invoke-RestMethod -Method Post http://127.0.0.1:8080/api/kill
```

## 7. MANTENIMIENTO

### 7.1 Actualizar dependencias

```powershell
cd C:\Users\BORISS\s9-fondo
npm outdated
npm update
npm audit fix
```

### 7.2 Rotar logs

```powershell
$stamp = Get-Date -Format "yyyy-MM"
if (Test-Path logs\s9.log) {
    Move-Item logs\s9.log "logs\s9_$stamp.log"
}
```

### 7.3 Backup del estado

```powershell
$stamp = Get-Date -Format "yyyy-MM-dd"
robocopy state "C:\Users\BORISS\Backups\s9-state_$stamp" /E /NFL /NDL /NJH /NJS
```

### 7.4 Git push diario

```powershell
cd C:\Users\BORISS\s9-fondo
git add .
git commit -m "daily: $(Get-Date -Format 'yyyy-MM-dd')"
git push
```

## 8. ROLLBACK DE EMERGENCIA

### 8.1 Parar todo inmediatamente

```powershell
# Kill proceso del motor S9
Get-Process node -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -like "*s9-fondo*" } |
    Stop-Process -Force
```

### 8.2 Volver a un commit anterior

```powershell
cd C:\Users\BORISS\s9-fondo
git log --oneline -10
git checkout <sha>   # inspeccionar
git checkout main    # volver
```

### 8.3 Restaurar desde backup

```powershell
$backup = "C:\Users\BORISS\Backups\s9-state_2026-04-20"
robocopy $backup C:\Users\BORISS\s9-fondo\state /E /NFL /NDL /NJH /NJS
```

## 9. TROUBLESHOOTING

| Problema | Diagnóstico | Solución |
|----------|-------------|----------|
| GUI no abre | `Get-NetTCPConnection -LocalPort 8080` | Matar proceso o cambiar `GUI_PORT` en `.env` |
| Binance rechaza | `Invoke-RestMethod https://fapi.binance.com/fapi/v1/ping` | Verificar IP whitelist API, no usar cloud USA |
| Telegram sin mensajes | Probar `getMe` | Revalidar token, chat_id |
| TV puerto 9222 muerto | `Get-NetTCPConnection -LocalPort 9222` | Relanzar TradingView con flag de debug |
| Señal no se ejecuta | Ver logs: "waiting for visual validation" | Normal fuera de ventana o si IA rechazó |
| Monte Carlo lento | CPU | Reducir iteraciones a 500 en validación rápida |

## 10. COMANDOS MÁS USADOS (REFERENCIA RÁPIDA)

```powershell
# Arrancar sistema
cd C:\Users\BORISS\s9-fondo; npm start

# Desarrollo con auto-reload
npm run dev

# Backtest
npm run backtest

# Monte Carlo
npm run montecarlo

# Health check
Invoke-RestMethod http://127.0.0.1:8080/api/health

# Ver logs vivos
Get-Content logs\s9.log -Tail 50 -Wait

# Parar motor vía API
Invoke-RestMethod -Method Post http://127.0.0.1:8080/api/kill

# Parar proceso directamente
Get-Process node | Where-Object { $_.Path -like "*s9-fondo*" } | Stop-Process -Force

# Git daily
git add .; git commit -m "daily: $(Get-Date -Format 'yyyy-MM-dd')"; git push
```

---

**Fin Informe 2 — Operación limpia, independiente, reproducible.**