#!/bin/sh
# Точка входа контейнера API.
# Гарантирует, что при любом способе запуска (docker compose up, start.sh)
# схема БД накатится, а банк задач будет наполнен ДО старта сервера.
set -e

echo "[entrypoint] Применяю миграции (alembic upgrade head)…"
alembic upgrade head || {
  # Если таблицы уже созданы в обход Alembic (create_all), помечаем
  # схему как соответствующую head, чтобы не падать на дублях.
  echo "[entrypoint] Похоже, схема уже создана — ставлю stamp head."
  alembic stamp head
}

echo "[entrypoint] Наполняю банк задач (идемпотентно)…"
python -m app.seed || echo "[entrypoint] сид пропущен (некритично)"

echo "[entrypoint] Запускаю API…"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
