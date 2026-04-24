# GUÍA DE MIGRACIÓN — De `claude-tradingview-mcp-trading` a `s9-fondo`

**Objetivo:** crear proyecto nuevo limpio, migrar solo lo esencial, dejar el antiguo archivado 30 días y luego eliminar.

**Tiempo estimado:** 45–90 minutos
**Prerrequisito:** Node.js ≥ 20, Git, PowerShell

---

## FASE 0 — DETENER EL SISTEMA ACTUAL

El bot legacy debe quedar apagado antes de migrar nada. Orden importa.

```powershell
# Detener Task Scheduler del bot antiguo
Disable-ScheduledTask -TaskName "TradingBot" -ErrorAction SilentlyContinue

# Matar cualquier proceso Node activo del proyecto antiguo
Get-Process node -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -like "*claude-tradingview-mcp-trading*" } |
    Stop-Process -Force

# Verificar que no queda nada corriendo
Get-Process node -ErrorAction SilentlyContinue | Format-Table Id, Path
```

**Checkpoint:** ninguna salida con `claude-tradingview-mcp-trading` en la ruta.

---

## FASE 1 — BACKUP ÚLTIMO DEL PROYECTO ANTIGUO

Antes de tocar nada, respaldo íntegro.

```powershell
$stamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$archive = "C:\Users\BORISS\Backups\legacy-final_$stamp"

robocopy "C:\Users\BORISS\claude-tradingview-mcp-trading" $archive /E /XD node_modules /NFL /NDL /NJH /NJS

Write-Host "Backup en: $archive"
Get-ChildItem $archive | Select-Object Name
```

**Checkpoint:** existe la carpeta `$archive` con los archivos del proyecto antiguo (sin `node_modules`).

---

## FASE 2 — CREAR PROYECTO NUEVO

```powershell
cd C:\Users\BORISS
mkdir s9-fondo
cd s9-fondo

git init
npm init -y
```

Editar `package.json` con estos scripts:

```json
{
  "name": "s9-fondo",
  "version": "2.0.0",
  "private": true,
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "backtest": "node backtest/engine.js",
    "montecarlo": "node validation/monte-carlo.js"
  },
  "engines": { "node": ">=20.0.0" }
}
```

Instalar dependencias:

```powershell
npm install express axios ws dotenv exceljs
npm install --save-dev nodemon
```

---

## FASE 3 — CREAR ESTRUCTURA DE CARPETAS

```powershell
cd C:\Users\BORISS\s9-fondo

$folders = @(
    "core",
    "execution",
    "validation",
    "gui",
    "gui\public",
    "backtest",
    "notify",
    "config",
    "state",
    "logs",
    "scripts",
    "docs"
)

foreach ($f in $folders) {
    New-Item -ItemType Directory -Force -Path $f | Out-Null
}

Get-ChildItem -Directory | Select-Object Name
```

**Checkpoint:** salida lista las 11 carpetas (sin `node_modules` que ya existe).

---

## FASE 4 — CREAR `.env` Y `.gitignore`

### 4.1 `.env`

```powershell
@"
# S9-FONDO — Configuración
MODE=STOP
GUI_PORT=8080
GUI_HOST=127.0.0.1

# Binance Futures
BINANCE_API_KEY=
BINANCE_API_SECRET=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=815415621

# TradingView MCP (validación visual)
TV_MCP_PORT=9222
TV_MCP_HOST=127.0.0.1

# Validación IA
AI_VALIDATION_ENABLED=true
AI_VALIDATION_MIN_CONFIDENCE=0.6
"@ | Out-File -FilePath .env -Encoding utf8
```

Luego `notepad .env` para completar los secretos.

### 4.2 `.env.example` (versión pública sin secretos)

```powershell
Copy-Item .env .env.example
# Editar .env.example y vaciar los valores sensibles
```

### 4.3 `.gitignore`

```powershell
@"
node_modules/
.env
state/
logs/
*.log
*.xlsx
.DS_Store
"@ | Out-File -FilePath .gitignore -Encoding utf8
```

**Checkpoint:**

```powershell
Test-Path .env
Test-Path .env.example
Test-Path .gitignore
```

Los tres deben ser `True`.

---

## FASE 5 — MIGRAR LO ESENCIAL

Solo se rescatan 3 elementos del proyecto antiguo. Todo lo demás queda en el archivo de backup.

```powershell
$old = "C:\Users\BORISS\claude-tradingview-mcp-trading"
$new = "C:\Users\BORISS\s9-fondo"

# 1. Parámetros S9
if (Test-Path "$old\s9-module\s9-rules.json") {
    Copy-Item "$old\s9-module\s9-rules.json" "$new\config\s9-rules.json"
    Write-Host "[OK] s9-rules.json migrado"
} else {
    Write-Host "[WARN] s9-rules.json no encontrado en proyecto viejo" -ForegroundColor Yellow
}

# 2. README del s9-module original como referencia histórica
if (Test-Path "$old\s9-module\README.md") {
    Copy-Item "$old\s9-module\README.md" "$new\docs\s9-module-original.md"
    Write-Host "[OK] README histórico preservado"
}

# 3. Histórico de trades para análisis (read-only)
if (Test-Path "$old\trades.csv") {
    Copy-Item "$old\trades.csv" "$new\state\legacy-trades-archive.csv"
    Write-Host "[OK] trades legacy archivados"
}

# Verificación
Get-ChildItem "$new\config", "$new\docs", "$new\state" -File |
    Select-Object FullName, Length
```

**Checkpoint:** tres archivos migrados.

---

## FASE 6 — COPIAR LOS 4 DOCUMENTOS DE REFERENCIA

Guardar los documentos generados en `docs/`:

```powershell
# Los 4 archivos que tengas descargados del chat:
# - INFORME_1_PROYECTO_COMPLETO.md
# - INFORME_2_ESTADO_ACTUAL_COMANDOS.md
# - ESTRUCTURA_LIMPIA.md
# - MIGRACION.md (este archivo)

# Copiarlos a C:\Users\BORISS\s9-fondo\docs\
Copy-Item "C:\Users\BORISS\Downloads\INFORME_1_PROYECTO_COMPLETO.md" "C:\Users\BORISS\s9-fondo\docs\" -Force
Copy-Item "C:\Users\BORISS\Downloads\INFORME_2_ESTADO_ACTUAL_COMANDOS.md" "C:\Users\BORISS\s9-fondo\docs\" -Force
Copy-Item "C:\Users\BORISS\Downloads\ESTRUCTURA_LIMPIA.md" "C:\Users\BORISS\s9-fondo\docs\" -Force
Copy-Item "C:\Users\BORISS\Downloads\MIGRACION.md" "C:\Users\BORISS\s9-fondo\docs\" -Force

Get-ChildItem "C:\Users\BORISS\s9-fondo\docs" | Select-Object Name
```

Ajustar las rutas de origen según dónde hayas descargado los archivos.

---

## FASE 7 — CREAR `README.md` BÁSICO DEL PROYECTO

```powershell
cd C:\Users\BORISS\s9-fondo

@"
# s9-fondo

Sistema de trading cuantitativo — Estrategia S9 Triplex.
Activos: BTCUSDT + ETHUSDT Futuros.

## Arranque

``````
npm start
``````

Abre http://127.0.0.1:8080

## Documentación completa

Ver ``docs/INFORME_1_PROYECTO_COMPLETO.md``

## Estado

MODE=STOP por defecto hasta completar validación visual y backtest.
"@ | Out-File -FilePath README.md -Encoding utf8
```

---

## FASE 8 — PRIMER COMMIT

```powershell
cd C:\Users\BORISS\s9-fondo

git add .
git status   # verificar qué se va a commitear
git commit -m "init: estructura base s9-fondo (refundación)"
```

### 8.1 (Opcional) Conectar a GitHub

Si se crea un repositorio nuevo privado llamado `s9-fondo`:

```powershell
git remote add origin https://github.com/thebronson97-star/s9-fondo.git
git branch -M main
git push -u origin main
```

---

## FASE 9 — CREAR `config/s9-rules.json` SI NO SE MIGRÓ

Si Fase 5 no encontró el archivo original, crear uno mínimo:

```powershell
cd C:\Users\BORISS\s9-fondo\config

@"
{
  "_meta": {
    "strategy": "S9_TRIPLEX",
    "version": "2.0.0",
    "status": "stop",
    "created": "$(Get-Date -Format 'yyyy-MM-dd')"
  },
  "general": {
    "symbols": ["BTCUSDT", "ETHUSDT"],
    "exchange": "BINANCE_FUTURES",
    "mode": "STOP",
    "enable_long": true,
    "enable_short": true,
    "timezone": "America/Bogota"
  },
  "trading_windows": {
    "ldn_ny_overlap": { "start_col": "08:30", "end_col": "10:30" },
    "asian_open":     { "start_col": "19:00", "end_col": "21:00" }
  },
  "placeholder_note": "Tier parameters por implementar según diseño S9 de Fase 1."
}
"@ | Out-File -FilePath s9-rules.json -Encoding utf8
```

---

## FASE 10 — VERIFICACIÓN FINAL

```powershell
cd C:\Users\BORISS\s9-fondo

# Estructura
Get-ChildItem -Directory

# Archivos raíz
Get-ChildItem -File | Select-Object Name, Length

# Config
Get-ChildItem config | Select-Object Name

# Docs
Get-ChildItem docs | Select-Object Name

# Estado del git
git status
git log --oneline
```

**Checkpoints:**
- 11 carpetas creadas
- `package.json`, `.env`, `.env.example`, `.gitignore`, `README.md` en raíz
- `config/s9-rules.json` presente
- `docs/` contiene 4 informes
- `git status` limpio
- Al menos 1 commit en `git log`

---

## FASE 11 — BOT ANTIGUO: CUARENTENA 30 DÍAS

No borrar todavía. Mantener por 30 días por si se necesita rescatar algo.

```powershell
# Renombrar para señalizar que está deprecado
cd C:\Users\BORISS
Rename-Item "claude-tradingview-mcp-trading" "DEPRECATED_claude-tradingview-mcp-trading_$(Get-Date -Format 'yyyy-MM-dd')"

# Verificar
Get-ChildItem "DEPRECATED*" -Directory
```

Pasados 30 días sin incidentes, eliminar:

```powershell
# SOLO tras 30 días sin incidentes
$old = Get-ChildItem "C:\Users\BORISS\DEPRECATED_claude-tradingview-mcp-trading_*" -Directory
Remove-Item -Recurse -Force $old.FullName
```

---

## FASE 12 — CONFIRMAR INDEPENDENCIA DE CLAUDE CODE

El sistema nuevo no debe depender de Claude Code en runtime. Verificar:

```powershell
cd C:\Users\BORISS\s9-fondo

# ¿Hay alguna referencia a Claude Code en el código?
Get-ChildItem -Recurse -File -Include *.js, *.json |
    Where-Object { $_.FullName -notlike "*node_modules*" } |
    Select-String -Pattern "claude-code|claude.ai|@anthropic" -List
```

**Esperado:** salida vacía. Si aparece algo, revisarlo — puede ser en un README migrado (OK) o en código (NO OK).

---

## RESUMEN: CHECKLIST DE MIGRACIÓN

- [ ] Task Scheduler del bot antiguo deshabilitado
- [ ] Procesos Node del proyecto antiguo detenidos
- [ ] Backup final del proyecto antiguo creado
- [ ] Carpeta `s9-fondo/` creada con 11 subcarpetas
- [ ] Dependencias npm instaladas (express, axios, ws, dotenv, exceljs, nodemon)
- [ ] `.env`, `.env.example`, `.gitignore` creados
- [ ] `config/s9-rules.json` migrado o creado
- [ ] `state/legacy-trades-archive.csv` migrado
- [ ] `docs/` contiene los 4 informes (proyecto, comandos, estructura, migración)
- [ ] `README.md` raíz creado
- [ ] Primer commit git realizado
- [ ] (Opcional) Repo GitHub conectado y push hecho
- [ ] Proyecto antiguo renombrado a `DEPRECATED_...`
- [ ] Verificación de independencia de Claude Code: OK
- [ ] `npm start` no da errores fatales (aunque aún no haya lógica, el GUI debe responder)

---

## PRÓXIMOS PASOS TRAS MIGRACIÓN

1. **Semana 1:** implementar `core/` (los 5 tiers + engine + windows)
2. **Semana 2:** implementar `backtest/` con Monte Carlo
3. **Semana 3:** implementar `gui/` y `notify/telegram.js`
4. **Semana 4:** implementar `validation/visual.js` + shadow testing
5. **Mes 2–3:** paper trading 60 días

Documentación de referencia durante desarrollo:
- `docs/INFORME_1_PROYECTO_COMPLETO.md` — arquitectura y lógica S9
- `docs/INFORME_2_ESTADO_ACTUAL_COMANDOS.md` — operación
- `docs/ESTRUCTURA_LIMPIA.md` — qué archivos crear
- `config/s9-rules.json` — parámetros exactos

---

**Migración completa.** Sistema listo para desarrollar sin carga heredada.