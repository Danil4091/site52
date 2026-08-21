# «Репетитор из Коми» — полный манифест восстановления

> Если песочница сбросилась: этот файл + переписка позволяют восстановить проект целиком.
> Стек: **React 18 + Vite + TS + Tailwind v4 + KaTeX + recharts + lucide-react** (фронт),
> **FastAPI + SQLAlchemy 2.0 async + PostgreSQL 16 + Alembic** (бэк, папка `backend/`).

---

## 1. Дизайн-система «Ночная математика» (критично для визуала!)

Тёмная тема по умолчанию — «чернильная доска» с тетрадной клеткой. Токены в `@theme` (`src/index.css`):

```
board-950 #070d17 · board-900 #0a1220 · board-850 #0d1830 · board-800 #12203a
board-700 #1b2c4d · board-600 #27406e
chalk-50 #f2f5fc · chalk-200 #dbe4f4 · chalk-300 #b9c6e0 · chalk-400 #8fa0c4
chalk-500 #6b7ca6 · chalk-600 #4d5d85
mark-yellow #ffc94d (CTA/XP) · mark-red #ff7a6b (ошибки/огонь)
mark-blue #6bd5ff (инфо) · mark-pink #ff9ecb (ачивки/Гроссмейстер)
mark-green #5ee6a8 (успех)
```

Шрифты (Google Fonts, кириллица!): **Unbounded** (display), **Golos Text** (body),
**JetBrains Mono** (цифры/код/ники), **Caveat** (рукописные пометки).
Фон: body — board-900 + radial-свечения (голубое справа сверху, золотое слева снизу) + fixed;
`.board-grid` — клетка 44px с mask; `.noise-overlay` — SVG-шум opacity .05 z-60.

Классы: `.card`, `.card-hover`, `.btn-gold`, `.btn-ghost`, `.tick` (подпись-капс), `.chip`,
`.numpad-key`, `.xp-track/.xp-fill` (shimmer), анимации: `rise` (+rise-1..5), `pop-in`,
`page-in`, `toast-in`, `feed-in`, `flame-live`, `count-pop`, `drift`, `marquee`,
`chalk-draw`, `blink`, `dock-in`, `shake`. Всё отключается при `prefers-reduced-motion`.
Светлая тема «тетрадь» — класс `.light` на `<html>`, инверсия тех же токенов
(переключатель луна/солнце в шапке, `theme.tsx`, ключ `komi-theme-v2`).

## 2. Карта файлов фронтенда (`src/`)

| Файл | Роль |
|---|---|
| `index.css` | Tailwind v4 + вся дизайн-система выше |
| `main.tsx` | ErrorBoundary + `window.onerror`/`unhandledrejection` (экран диагностики) + ThemeProvider + AppProvider |
| `App.tsx` | Маршрутизация по `route` из store + модалки (Auth, Legal, ForgotPassword) + VkContactWidget |
| `product/config.ts` | Всё из `import.meta.env` с дефолтами (см. §6) |
| `product/data.ts` | BANK (19 тем), REAL_VARIANT (19 задач), PROB_PROBLEMS (12), DAILY_TIPS (18), ACHIEVEMENTS (26), TITLES (5), LEADER_SEED (12, с xp), SCALE (0–31→0–100), ERROR_TAGS (6), INITIAL_ATTEMPTS (3, с ts) |
| `product/store.tsx` | Центральный Context: пользователь, попытки, ошибки, ачивки, стрик+XP+freezes, теги, марафон, рефералы, банк задач, опубликованные варианты. **Все ключи localStorage scoped по нику: `ключ@ник`** |
| `product/ui.tsx` | LatexText (KaTeX: `$…$`, `$$…$$`, `\(…\)`, markdown-картинки), TaskImage+зум, sanitizeAnswer, Numpad+FieldDockProvider (**одна глобальная плавающая клавиатура**, `onPointerDown preventDefault` — не теряет фокус), AnswerInput (readOnly-режим), Heatmap, Sparkline, XpBar (титул+подсказка), TitleBadge, StreakFlame (❄×N), ConfettiBurst (canvas, 2 пушки), Avatar |
| `product/shell.tsx` | Header (лого √, нав, тема, колокольчик, LVL+титул под ником, выход; мобильные иконки), LiveTicker (ники!), MobileNav (5 вкладок, ученик/преподаватель — разные), Footer (юр.ссылки), Toasts, FloatingFormulas, useTypewriter |
| `product/pages.tsx` | HomePage (bento: отсчёт до ЕГЭ 07.06.2027 + пометка ФИПИ, стрик+покупка страховки, XP, «серия под угрозой», heatmap, задача дня (рандом из пула части 1 по дате), динамика+прогноз, совет дня, «продолжить», «приведи друга»), BankPage (19 тем, фильтры, запуск тренажёра), VariantsPage (+авторские варианты), RunPage (**два режима: тест без решений → разбор после «Завершить»**: поля readOnly, статистика, решения/эталоны только в разборе), ResultsPage, ProbabilityPage |
| `product/pages2.tsx` | WeeklyReport (отчёт за 7 дней), AnalyticsPage (KPI, recharts ComposedChart: линия балла + бары ошибок; ReferenceLine: цель (жёлтый пунктир), РФ·64 (синий точечный), порог 70), Heatmap, «зоны роста», MistakesPage (**теги причин**: потеря знака/ОДЗ/арифметика/невнимательность/не знал метод/не хватило времени + статистика), RatingPage (пьедестал + топ-10 **только ники** + своя строка с титулом + 26 ачивок), AdminPage (вкладки: Банк/Импорт/Варианты/Ученики) |
| `product/MarathonPage.tsx` | Марафон: 5/10/15 задач, 45 с/задачу (автопереход), мгновенная проверка, XP-бонус за скорость, рекорд |
| `product/TrainerPage.tsx` + `feed.ts` | Тренажёр темы: очередь, «Решать 5/10/всё», «Показать ещё», автоподгрузка при верном, решённые зеленеют/сворачиваются, «Тема пройдена на 100%»+конфетти, дедуп по `solvedTaskIds` |
| `product/VariantUploader.tsx` | Drag&drop JSON варианта → валидация (variantTitle/tasks/number/latex_statement/answer, типы short_answer/detailed_answer) → KaTeX-превью → «Опубликовать» → ссылка `?variant=VAR-XXXXXXXX`; фолбэк: сервер → localStorage |
| `product/PublishedVariantRunner.tsx` | Запуск авторского варианта по ссылке **без логина** (автономно) |
| `product/Part2Task.tsx` | Часть 2: без учителя — плашка «автопроверка только с преподавателем» + «Ввести код»; с учителем — «Автопроверка ИИ/отправить» (симуляция 900 мс) + «Эталонное решение» |
| `product/AttachTeacherModal.tsx` | Привязка по коду (ARTEM-PRO / KOMI-XXXXXX) |
| `product/AuthModal.tsx` | Чистая регистрация: ник (обяз., 3–16, уникален), пароль+подтверждение, «Код преподавателя» (опц.), слайдер цели 40–100, чекбокс ПДн (обязат.); вход ник+пароль; автореф `?ref=`; мастер-аккаунт сидится из config |
| `product/LegalDocs.tsx` | Политика ПДн (152-ФЗ) + Оферта самозанятого (плейсхолдеры ФИО/ИНН), 6+ |
| `product/ForgotPassword.tsx`, `NotificationsBell.tsx`, `VkContactWidget.tsx` | восстановление пароля; колокольчик; ВК-виджет (sticky на десктопе, плашка+крестик на мобильных, фото `VITE_TUTOR_PHOTO_URL`, кнопка `VITE_VK_GROUP_URL`) |
| `product/api.ts` | Клиент: `API_URL` из `VITE_API_URL`, graceful-фолбэк, loginTeacher/uploadVariant/fetchVariant/importTasks/checkTask |
| `product/variantSchema.ts` | Типы + validateVariantJson + makeLinkCode (без 0/O/1/I) + resolveTeacher |

## 3. Геймификация (цифры!)

- XP: +10/задача, +15/новый день серии, +20…300/ачивка, +30 бонус скорости марафона, рефералы: пригласивший +50, приглашённый +30.
- Уровень: каждые 100 XP. Титулы: **1 «Новичок», 5 «Разведчик», 10 «Боец», 15 «Мастер», 25 «Гроссмейстер ЕГЭ»** (розовый+корона) — в рейтинге, шапке, XpBar.
- **Страховка серии**: 100 XP → ❄×1; пропущенный день съедает страховку, а не серию (авто, с уведомлением); лимит 1; ачивка «Предусмотрительный».
- 26 ачивок (id): first-task, first-variant, warmup, marathon, streak-7/14/30, prob-genius(50), flawless(100%), threshold, eighty, ninety, hundred, eraser, sniper, night-owl, sprinter, marathon-master(8+/10), friendly(1), ambassador(3), analyst(5 тегов), weekly-hero(3 вар./нед), goal-getter, explorer(10 тем), centurion(100 задач), prepared.
- Рефералка: код `KOMI-{НИК6}` из ника, ссылка `?ref=`, журнал `komi-reflog-v1`.

## 4. Приватность (важно!)

Публично — **только ник** (рейтинг, тикер, «мои ученики»). Имя/email — лишь в профиле и кабинете учителя. Данные изолированы по `ключ@ник`. Согласие ПДн при регистрации обязательно.

## 5. Доступы (демо)

- Преподаватель: **ник `artem`, пароль `artem-2026`**, код ученикам **`ARTEM-PRO`**.
- Кабинет: вход под artem (авто-переход) или `?panel=komi2026`.
- Ответы части 1 реального варианта: 1→0.6, 2→11, 3→5, 4→0.94, 5→0.56, 6→13, 7→8, 8→2, 9→6, 10→3, 11→3, 12→0. Чертежи: №1 (треугольник) и №8 (касательная) — imageUrls (qwenlm CDN).

## 6. Переменные окружения

Фронт (`.env.example`): `VITE_API_URL`, `VITE_EGE_DATE=2027-06-07`, `VITE_RU_AVG_SCORE=64`,
`VITE_VK_GROUP_URL`, `VITE_TUTOR_PHOTO_URL`, `VITE_ADMIN_NICKNAME=artem`,
`VITE_ADMIN_PASSWORD=artem-2026`, `VITE_ADMIN_TEACHER_CODE=ARTEM-PRO`.
Бэк (`backend/.env.example`): `DATABASE_URL`, `HMAC_SECRET` (alias `SECRET_KEY`),
`CORS_ORIGINS`, `ADMIN_USERNAME/PASSWORD/TEACHER_CODE`, `PUBLIC_BASE_URL`.

## 7. Бэкенд (`backend/`)

- `app/main.py` (монолит): health; импорт/список/темы задач; **лента темы** `GET /api/topics/{n}/feed?limit&offset` (JOIN task_progress — только нерешённые); `POST /api/tasks/{id}/check` (`,`→`.`); register (teacher_code→teacher_id, telegram_id); forgot-password; `POST /api/v1/auth/login` (HMAC-токены, без зависимостей); **`POST /api/v1/variants/upload`** (только teacher, Pydantic: latex обязателен, short_answer⇒answer обязателен, detailed_answer⇒answer=null, номера уникальны) → variant_id + short_code + public_url; **`GET /api/v1/variants/{id}`** (публично, UUID или short_code); `ensure_admin()` при старте.
- `app/models.py`: User (nickname, role, telegram_id, teacher_code, streak_*), Task (exam_type ege/oge, CHECK difficulty 1–3, part1⇒answer NOT NULL), Variant (short_code unique, tasks_json JSONB, created_by_teacher_id NULL-SET), VariantTask, VariantAttempt (CHECK 0–31/0–100), TaskAttempt, TaskProgress (uq user+task).
- Alembic: `alembic.ini`, `alembic/env.py` (async), `versions/0001_initial_schema.py` (все таблицы+enum+индексы, полный downgrade).
- `scripts/create_admin.py`, `requirements.txt`, `README.md`.

## 8. GitHub (защита от сбросов!)

`.gitignore` (node_modules, dist, .env, __pycache__, venv, uploads, backups), `README.md`,
`GITHUB_SETUP.md` (7 шагов: ZIP из песочницы → git init → push). Репозиторий: приватный `repetytor-iz-komi`.

## 9. Как восстанавливать в новой сессии

1. Прочитать этот файл + переписку (в ней полный код всех файлов).
2. Пересоздать `src/index.css` **с точными токенами из §1** — иначе «не тот дизайн».
3. Порядок: config → data → store → ui → shell → pages/pages2 → Marathon/Trainer/VariantUploader/Part2Task/Auth/Legal/виджеты → App/main → backend.
4. `npm i katex recharts lucide-react` уже в package.json. Сборка: `npm run build`.
5. Известные грабли: все иконки должны быть импортированы в каждом файле (ошибка `X is not defined` валит модуль ДО ErrorBoundary → пустой экран); `Snowflake` в data.ts; `FREEZE_COST` экспортируется из store; снапшот ачивок в pages2 должен содержать ВСЕ поля AchieveSnapshot.

## 10. Что НЕ реализовано (кандидаты)

Реальная ИИ-проверка части 2 (сейчас симуляция) · Telegram-бот (задел telegram_id есть) ·
PWA · code-splitting (чанк 1,09 МБ) · обмен XP на реальные бонусы · реальный SMTP сброса пароля.
