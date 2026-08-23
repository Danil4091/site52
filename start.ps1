# ─────────────────────────────────────────────────────────────────────
# Репетитор из Коми · бесшовный локальный запуск (Windows PowerShell)
# Одна команда:  .\start.ps1
#
# Что делает:
#   1. Создаёт/дополняет .env (гарантирует VITE_API_URL).
#   2. Поднимает Docker: PostgreSQL + API (схема накатится сама).
#   3. Ждёт готовности PostgreSQL.
#   4. Ждёт готовности API и применяет миграции Alembic (идемпотентно).
#   5. Ставит npm-зависимости (если нет) и запускает фронтенд.
# ─────────────────────────────────────────────────────────────────────
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "══ Репетитор из Коми · локальный запуск ══════════════════════════"

Write-Host "[1/5] Проверяю .env…"
node scripts/ensure-env.js

Write-Host "[2/5] Поднимаю Docker (PostgreSQL + API)…"
docker compose up -d
if ($LASTEXITCODE -ne 0) {
  Write-Error "Docker не запустился. Установите Docker Desktop и убедитесь, что он запущен."
  exit 1
}

Write-Host "[3/5] Жду готовности PostgreSQL…"
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  docker compose exec -T db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Seconds 1
}
if (-not $ready) {
  Write-Error "PostgreSQL не поднялся за 60 секунд."
  docker compose logs db
  exit 1
}
Write-Host "      PostgreSQL готов."

Write-Host "[4/5] Жду API и применяю миграции…"
$apiReady = $false
for ($i = 0; $i -lt 90; $i++) {
  try {
    Invoke-WebRequest -Uri "http://localhost:8000/api/health" -UseBasicParsing -TimeoutSec 2 | Out-Null
    $apiReady = $true
    break
  } catch {
    Start-Sleep -Seconds 1
  }
}
if (-not $apiReady) {
  Write-Error "API не поднялся за 90 секунд."
  docker compose logs api
  exit 1
}
# Миграции уже накатил entrypoint; здесь — контрольный no-op (или stamp).
docker compose exec -T api alembic upgrade head
if ($LASTEXITCODE -ne 0) { docker compose exec -T api alembic stamp head }
Write-Host "      Миграции применены, API готов."

Write-Host "[5/5] Запускаю фронтенд…"
if (-not (Test-Path node_modules)) {
  Write-Host "      Устанавливаю npm-зависимости (первый запуск)…"
  npm install
}

Write-Host "═════════════════════════════════════════════════════════════════"
Write-Host "  Сайт:   http://localhost:3000"
Write-Host "  API:    http://localhost:8000/docs  (Swagger)"
Write-Host "  Вход:   daniil / Pudov-Ege-2026  (код ученикам: SYSOLA-PRO)"
Write-Host "═════════════════════════════════════════════════════════════════"
npm run dev
