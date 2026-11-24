# ReyesFruitHub · ejecuta todos los chequeos y pruebas contra una base SEPARADA (reyesfruithub_test).
# Tu base real (reyesfruithub) no se toca.
#   powershell -ExecutionPolicy Bypass -File tests\probar.ps1
$ErrorActionPreference = 'Continue'
$raiz = Split-Path $PSScriptRoot -Parent
Set-Location $raiz
$env:RFH_DB = 'reyesfruithub_test'
$puerto = 8091
$base = "http://localhost:$puerto"
$res = [ordered]@{}

if (-not (Test-Path "$PSScriptRoot\node_modules\playwright-core")) {
  Write-Host "Instalando playwright-core para la prueba de interfaz..." -ForegroundColor Cyan
  Push-Location $PSScriptRoot; npm install --silent; Pop-Location
}

Write-Host "`n== 1. Base de pruebas desde cero ==" -ForegroundColor Cyan
php database/instalar.php --reset --si; $res['Instalación'] = $LASTEXITCODE

Write-Host "`n== 2. Chequeo de la base recién instalada ==" -ForegroundColor Cyan
php database/chequeo.php; $res['Chequeo inicial'] = $LASTEXITCODE

$srv = Start-Process php -ArgumentList '-S', "localhost:$puerto", 'servidor.php' -WorkingDirectory $raiz -PassThru -WindowStyle Hidden
try {
  for ($i = 0; $i -lt 40; $i++) { try { Invoke-WebRequest "$base/api/?accion=estado" -UseBasicParsing -TimeoutSec 1 | Out-Null; break } catch { Start-Sleep -Milliseconds 250 } }

  Write-Host "`n== 3. Pruebas de la API ==" -ForegroundColor Cyan
  node tests/api.test.mjs $base; $res['API'] = $LASTEXITCODE

  Write-Host "`n== 4. Chequeo de integridad después de las pruebas ==" -ForegroundColor Cyan
  php database/chequeo.php; $res['Chequeo tras pruebas'] = $LASTEXITCODE

  Write-Host "`n== 5. Concurrencia real (varios procesos) ==" -ForegroundColor Cyan
  php tests/concurrencia.php; $res['Concurrencia'] = $LASTEXITCODE

  Write-Host "`n== 6. Interfaz de punta a punta ==" -ForegroundColor Cyan
  php database/instalar.php --reset --si | Out-Null
  node tests/e2e.test.mjs $base; $res['Interfaz'] = $LASTEXITCODE
}
finally { Stop-Process -Id $srv.Id -Force -ErrorAction SilentlyContinue }

Write-Host "`n== Resumen ==" -ForegroundColor Cyan
$fallas = 0
foreach ($k in $res.Keys) {
  if ($res[$k] -eq 0) { Write-Host ("  OK     " + $k) -ForegroundColor Green } else { Write-Host ("  FALLA  " + $k) -ForegroundColor Red; $fallas++ }
}
exit $fallas
