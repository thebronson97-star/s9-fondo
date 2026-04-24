# check-core.ps1 — Verifica core/ completo y sintaxis JS
$base = "C:\Users\BORISS\s9-fondo"
$pass = 0; $fail = 0

function ok($m)  { Write-Host "[OK] $m" -ForegroundColor Green;  $script:pass++ }
function err($m) { Write-Host "[--] $m" -ForegroundColor Red;    $script:fail++ }

Write-Host "`n=== S9 CORE VERIFICATION ===" -ForegroundColor Cyan

# 1. Archivos presentes
$files = @(
  "index.js",
  "core\indicators.js",
  "core\regime.js",
  "core\tier1-po3.js",
  "core\tier2-amt.js",
  "core\tier3-smt.js",
  "core\tier4-confirm.js",
  "core\tier5-risk.js",
  "core\signal.js",
  "core\windows.js",
  "core\engine.js"
)

foreach ($f in $files) {
  if (Test-Path "$base\$f") { ok "EXISTS: $f" } else { err "MISSING: $f" }
}

# 2. Sintaxis JS con node --check
Write-Host "`n--- Syntax Check ---" -ForegroundColor Cyan
foreach ($f in $files) {
  $full = "$base\$f"
  if (Test-Path $full) {
    $out = node --check $full 2>&1
    if ($LASTEXITCODE -eq 0) { ok "SYNTAX OK: $f" }
    else { err "SYNTAX ERROR: $f`n   $out" }
  }
}

# 3. Require chain test (smoke test signal.js)
Write-Host "`n--- Require Chain ---" -ForegroundColor Cyan
$smokeScript = @"
try {
  const s = require('$($base.Replace('\','\\'))\\core\\signal');
  console.log('signal.js loaded OK, exports:', Object.keys(s).join(', '));
} catch(e) {
  console.error('REQUIRE FAILED:', e.message);
  process.exit(1);
}
"@

$tmpFile = "$env:TEMP\s9-smoke.js"
$smokeScript | Out-File -FilePath $tmpFile -Encoding utf8
$out = node $tmpFile 2>&1
if ($LASTEXITCODE -eq 0) { ok "Require chain: $out" }
else { err "Require chain FAILED: $out" }
Remove-Item $tmpFile -ErrorAction SilentlyContinue

# 4. Windows test
Write-Host "`n--- Windows Test ---" -ForegroundColor Cyan
$winScript = @"
const w = require('$($base.Replace('\','\\'))\\core\\windows');
const win = w.getCurrentWindow();
console.log('Window:', win.name, '| Active:', win.active);
const next = w.minutesUntilNextWindow();
console.log('Next window:', next.name, 'in', next.minutes, 'min');
"@
$tmpFile2 = "$env:TEMP\s9-win.js"
$winScript | Out-File -FilePath $tmpFile2 -Encoding utf8
$out2 = node $tmpFile2 2>&1
if ($LASTEXITCODE -eq 0) { ok "Windows: $out2" }
else { err "Windows FAILED: $out2" }
Remove-Item $tmpFile2 -ErrorAction SilentlyContinue

Write-Host "`n=== RESULTADO: $pass OK / $fail FALLOS ===" -ForegroundColor $(if ($fail -eq 0) {"Green"} else {"Yellow"})