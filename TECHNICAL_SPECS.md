# «Репетитор из Коми» — технические спецификации (TECHNICAL_SPECS)

> Комплексный аудит + инфраструктура, нагрузки, масштабирование. Дата: 2026.

---

## 1. Результаты аудита (Code Audit & Quality)

### 1.1 Что проверено и в порядке ✅
- **Сборка**: `vite build` — зелёная, 2004 модуля, без ошибок.
- **KaTeX**: `throwOnError:false` + `errorColor` — битая формула не роняет приложение (ui.tsx:31).
- **Error Boundaries**: React `ErrorBoundary` (main.tsx) + глобальные `window.onerror` и `unhandledrejection` — вместо белого экрана диагностика.
- **Ленивая загрузка**: 10 тяжёлых страниц (recharts, кабинеты, раннеры) — отдельные чанки, старт облегчён.
- **Валидация ответов**: `sanitizeAnswer` пропускает только цифры/«-»/«,»/«.»; сравнение через `answersMatch` (нормализация запятой и ведущих нулей).
- **Импорт JSON**: построчная валидация с указанием номера строки и причины, дедупликация.

### 1.2 Найденные и исправленные недочёты 🔧
| Недочёт | Исправление |
|---|---|
| `bindTeacherApi(code, token)` — перепутаны аргументы (привязка к боевому серверу не работала) | Сигнатура `(token, code)` (ProfileSettings.tsx) |
| Touch-цели кнопок шапки 36px < 44px | Колокольчик, тема, выход, «Журнал ошибок» → `h-11 w-11` на мобильном (md:h-9) |
| Фильтры Банка и вкладки кабинета ~36px | `min-h-[44px] inline-flex items-center` (pages.tsx, pages2.tsx) |

### 1.3 Выполнено (оптимизация и безопасность)
- **Пароли — bcrypt** (`backend/app/security.py`): регистрация и вход хешируют/проверяют через bcrypt (12 раундов). Legacy plaintext-пароли демо-аккаунтов мигрируются бесшовно при первом успешном входе. `create_admin.py` использует тот же алгоритм.
- **Code-splitting KaTeX и recharts**:
  - KaTeX грузится лениво (отдельный чанк ~261 КБ, параллельно со стартом).
  - recharts вынесен в `AnalyticsChart.tsx` (отдельный чанк ~418 КБ, грузится только при открытии «Аналитики»).
  - Стартовый чанк `index` уменьшен с **589 → 327 КБ** (−44%), чанк `pages2` — с **472 → 55 КБ** (−88%). Предупреждение «чанк > 500 КБ» исчезло.

---

## 2. Мобильная адаптивность и UI/UX

### 2.1 Аудит 360–430px ✅
- Нижняя навигация: `grid-cols-5`, высота ~48px, `safe-area-inset-bottom` — помещается без скролла.
- Шапка: логотип + иконки (44px), ник/титул скрыты на узких экранах.
- Виртуальная клавиатура (NumpadDock): на мобильном `bottom-[4.6rem]` (над навигацией), на десктопе — плавающая справа; `AnswerInput` при фокусе делает `scrollIntoView(center)`, чтобы поле не пряталось.
- Touch-цели: все интерактивные элементы ≥ 44×44px на тач-экранах.
- Горизонтальный скролл страницы отсутствует (`overflow-x:hidden` на body).

### 2.2 Визуальный стиль «Ночная математика»
- Тёмный чернильный холст с тетрадной клеткой и меловой текстурой (noise-overlay).
- Полихромная палитра: золото #ffc94d, коралл #ff7a6b, голубой #6bd5ff, мята #5ee6a8, роза #ff9ecb.
- Шрифты: Unbounded (дисплей) + Golos Text (текст) + JetBrains Mono (цифры) + Caveat (пометки).
- Микро-анимации: hover-подъёмы, scroll-reveal, печатающийся слоган, конфетти, пульсации; `prefers-reduced-motion` уважается.
- Светлая тема «тетрадь» — полный инверс токенов.

---

## 3. Инфраструктура и деплой

### 3.1 Стек
| Слой | Технология |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind v4, recharts, KaTeX, lucide-react |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0 (async), asyncpg, Alembic, Pydantic v2 |
| БД | PostgreSQL 16 |
| Инфра | Docker + Docker Compose + Nginx (SSL) |

### 3.2 Пошаговый деплой (VPS: Ubuntu 22.04, 2–4 vCPU, 4–8 GB RAM)

**Шаг 1. Установка Docker:**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
```

**Шаг 2. Загрузка проекта и настройка окружения:**
```bash
git clone https://github.com/<вы>/repetytor-iz-komi.git && cd repetytor-iz-komi
cp backend/.env.example backend/.env     # заполнить SECRET_KEY, DATABASE_URL
cp .env.example .env                     # VITE_API_URL=https://ваш-домен.ru
```

**Шаг 3. Сборка фронтенда:**
```bash
npm install && npm run build             # результат в dist/
```

**Шаг 4. Запуск бэкенда + БД:**
```bash
cd backend && docker compose up -d --build
docker compose exec api alembic upgrade head     # миграции
docker compose exec api python scripts/create_admin.py  # мастер-аккаунт преподавателя
```

**Шаг 5. Nginx + SSL:**
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```
Конфиг `/etc/nginx/sites-available/repetytor`:
```nginx
server {
    server_name ваш-домен.ru;
    root /var/www/repetytor/dist;          # фронтенд
    index index.html;
    location / { try_files $uri $uri/ /index.html; }   # SPA
    location /api/ { proxy_pass http://127.0.0.1:8000; # бэкенд
        proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/repetytor /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d ваш-домен.ru       # бесплатный SSL
```

**Шаг 6. Резервное копирование** (ежедневно в 03:00):
```bash
crontab -e
0 3 * * * /путь/к/backend/backup.sh >> /путь/к/backend/backups/backup.log 2>&1
```

---

## 4. Нагрузки и масштабирование

### 4.1 Оценка пиковой нагрузки (базовый VPS 2 vCPU / 4 GB RAM)
| Показатель | Оценка | Обоснование |
|---|---|---|
| Простые GET (задачи, темы) | **~400–700 RPS** | async FastAPI + пул asyncpg, запросы 1–5 мс |
| Смешанная нагрузка (решение, попытки) | **~150–300 RPS** | запись в БД + нормализация ответов |
| Одновременных учеников (peak, вечер 18–22ч) | **~1500–4000** | при среднем «думании» 10–30 с между запросами |
| DAU в сезон ЕГЭ (июнь) | **до ~10 000** | на одном базовом VPS |

**Узкие места и масштабирование:**
- Пул соединений asyncpg: 10–20 по умолчанию; при >5000 DAU поднять до 50 и добавить PgBouncer.
- Первым масштабируется чтение: кеширование задач/тем (Redis) — они почти неизменны.
- При >10 000 DAU: отдельный VPS под PostgreSQL, репликация чтения, CDN для фронтенда.

### 4.2 Ёмкость базы данных
| Сущность | Размер на запись | 10 000 записей | Примечание |
|---|---|---|---|
| Task (условие+решение+критерии) | ~8–12 КБ | ~80–120 МБ | текст с LaTeX |
| Variant (JSONB, ~15 задач) | ~50 КБ | 1 000 вариантов ≈ 50 МБ | чертежи — ссылки, не в БД |
| VariantAttempt | ~200 Б | 1 000 000 ≈ 200 МБ | + индексы ~100 МБ |
| TaskAttempt | ~150 Б | 12 000 000 ≈ 1.8 ГБ | самая быстрорастущая |
| User | ~400 Б | 100 000 ≈ 40 МБ | |

**Итог:** при 10 000 учеников и активной практике суммарно **~2–4 ГБ за первый год** — с запасом укладывается в стандартный VPS-диск 20–40 ГБ. Чертежи хранятся ссылками (внешний хостинг / `uploads/`), не раздувая БД.

---

## 5. Чек-лист безопасности перед запуском
- [ ] `SECRET_KEY` — длинная случайная строка из окружения (не в коде)
- [x] Пароли — bcrypt (внедрено: `backend/app/security.py`, регистрация/вход/CLI-создание админа; бесшовная миграция legacy-паролей)
- [ ] CORS — только ваш домен в `CORS_ORIGINS`
- [ ] SSL (certbot) + HSTS
- [ ] `teacher_code` и `?panel=komi2026` — сменить на непредсказуемые
- [ ] Резервное копирование по cron + копия вне сервера (облако)
- [ ] Уведомление Роскомнадзора об обработке ПДн
