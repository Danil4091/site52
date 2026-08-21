# Репетитор из Коми · Бэкенд

FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL. Банк задач, авторские варианты,
попытки, стрики и кабинет преподавателя.

## Быстрый старт (Docker)

```bash
cd backend
cp .env.example .env          # и обязательно смените HMAC_SECRET!
docker compose up -d          # поднимет PostgreSQL + API
alembic upgrade head          # накатит схему (см. ниже) — или она создастся сама при старте
```

- API: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`

## Переменные окружения (`.env`)

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | Подключение к PostgreSQL (asyncpg) |
| `HMAC_SECRET` | Секрет подписи токенов авторизации (смените!) |
| `CORS_ORIGINS` | Разрешённые домены фронтенда, через запятую |
| `PUBLIC_BASE_URL` | База для публичных ссылок на варианты |
| `FRONTEND_URL` | Для ссылок в письмах (сброс пароля) |

`SECRET_KEY` поддерживается как устаревший alias `HMAC_SECRET`.

## Миграции (Alembic)

Схема управляется Alembic. Первичная миграция `0001_initial_schema` создаёт
все таблицы: `users`, `variants` (с JSONB `tasks_json` и `short_code`),
`tasks`, `variant_tasks`, `variant_attempts`, `task_attempts`, `task_progress`.

```bash
pip install -r requirements.txt
export DATABASE_URL=postgresql+asyncpg://komi:komi_secret@localhost:5432/repetytor

alembic upgrade head          # применить миграции
alembic downgrade -1          # откатить последнюю
alembic revision --autogenerate -m "описание"   # новая миграция из моделей
```

> Примечание: приложение при старте также вызывает `Base.metadata.create_all`,
> поэтому на свежей базе таблицы появятся и без Alembic. Для уже существующей
> базы с другой схемой `variants` — используйте Alembic (или пересоздайте таблицу).

## Ключевые эндпоинты

| Метод | Путь | Доступ | Назначение |
|---|---|---|---|
| POST | `/api/v1/variants/upload` | преподаватель (HMAC-токен) | Загрузка варианта → `variant_id` + короткая ссылка |
| GET | `/api/v1/variants/{id}` | публично | Вариант для прохождения (по UUID или `short_code`) |
| POST | `/api/v1/auth/login` | все | Вход, возвращает токен и роль |
| POST | `/api/tasks/import` | — | Массовая загрузка задач |
| GET | `/api/topics/{number}/feed` | — | Лента задач темы (дедуп по user+task) |
| POST | `/api/tasks/{id}/check` | — | Проверка ответа (запятая = точка) |

## Проверка схемы

Pydantic-схемы `TaskSchema` / `VariantCreateSchema` в `app/main.py`:
- `latex_statement` обязателен;
- `type` — только `short_answer` / `detailed_answer`;
- для `short_answer` обязателен `answer`, для `detailed_answer` он обнуляется;
- номера задач в варианте уникальны.

`Variant.short_code` генерируется из алфавита без `0/O/1/I` с проверкой
уникальности в БД (5 попыток, иначе 500).
