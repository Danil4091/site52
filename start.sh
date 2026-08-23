#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Репетитор из Коми · бесшовный локальный запуск (Linux / macOS)
# Одна команда:  ./start.sh
#
# Что делает:
#   1. Создаёт/дополняет .env (гарантирует VITE_API_URL).
#   2. Поднимает Docker: PostgreSQL + API (схема накатится сама).
#   3. Ждёт готовности PostgreSQL.
#   4. Ждёт готовности API и применяет миграции Alembic (идемпотентно).
#   5. Ставит npm-зависимости (если нет) и запускает фронтенд.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

echo "══ Репетитор из Коми · локальный запуск ══════════════════════════"

echo "[1/5] Проверяю .env…"
node scripts/ensure-env.js

echo "[2/5] Поднимаю Docker (PostgreSQL + API)…"
docker compose up -d

echo "[3/5] Жду готовности PostgreSQL…"
for i in $(seq 1 60); do
  if docker compose exec -T db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "ОШИБКА: PostgreSQL не поднялся за 60 секунд." >&2
    docker compose logs db
    exit 1
  fi
  sleep 1
done
echo "      PostgreSQL готов."

echo "[4/5] Жду API и применяю миграции…"
for i in $(seq 1 90); do
  if curl -sf http://localhost:8000/api/health >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 90 ]; then
    echo "ОШИБКА: API не поднялся за 90 секунд." >&2
    docker compose logs api
    exit 1
  fi
  sleep 1
done
# Миграции уже накатил entrypoint; здесь — контрольный no-op (или stamp,
# если таблицы были созданы в обход Alembic).
docker compose exec -T api alembic upgrade head || docker compose exec -T api alembic stamp head
echo "      Миграции применены, API готов."

echo "[5/5] Запускаю фронтенд…"
if [ ! -d node_modules ]; then
  echo "      Устанавливаю npm-зависимости (первый запуск)…"
  npm install
fi

echo "═════════════════════════════════════════════════════════════════"
echo "  Сайт:   http://localhost:3000"
echo "  API:    http://localhost:8000/docs  (Swagger)"
echo "  Вход:   daniil / Pudov-Ege-2026  (код ученикам: SYSOLA-PRO)"
echo "═════════════════════════════════════════════════════════════════"
npm run dev
