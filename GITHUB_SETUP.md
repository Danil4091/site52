# 🚀 Как залить проект «Репетитор из Коми» на GitHub

Пошаговая инструкция. Все команды — для Windows (PowerShell).
На Mac/Linux команды те же, но вместо `\` используйте `/` в путях.

---

## Шаг 0. Достать код из этой песочницы

Прежде чем пушить на GitHub, код нужно получить на свой компьютер.

**Вариант А (рекомендуется).** В интерфейсе этого чата найдите кнопку
**«Download ZIP» / «Export» / «Скачать проект»** (обычно в меню «⋯» рядом с
предпросмотром). Скачается архив с полным кодом. Распакуйте его в папку,
например:

```
C:\Users\ВашеИмя\Projects\repetytor-iz-komi
```

**Вариант Б.** Если кнопки скачивания нет — напишите мне в чат, и я соберу код
в один файл-скрипт, который развернёт проект на вашем компьютере одной командой.

---

## Шаг 1. Установить Git

1. Скачайте Git с https://git-scm.com/download/win
2. Устанавливайте, нажимая «Next» (настройки по умолчанию подойдут).
3. Проверьте в PowerShell:

```powershell
git --version
```

Должна появиться версия, например `git version 2.45.0`.

---

## Шаг 2. Создать репозиторий на GitHub

1. Откройте https://github.com и войдите (или зарегистрируйтесь).
2. Нажмите **«+» → «New repository»**.
3. Заполните:
   - **Repository name:** `repetytor-iz-komi`
   - **Description:** `Платформа подготовки к ЕГЭ/ОГЭ по математике`
   - Выберите **Private** (приватный — код виден только вам; для пилота этого достаточно).
   - **НЕ ставьте** галочки «Add README», .gitignore, license (у нас они уже есть).
4. Нажмите **«Create repository»**.
5. GitHub покажет адрес вида:
   `https://github.com/ВАШ_ЛОГИН/repetytor-iz-komi.git` — он понадобится дальше.

---

## Шаг 3. Первый коммит и push

Откройте **PowerShell** и перейдите в папку с распакованным кодом:

```powershell
cd C:\Users\ВашеИмя\Projects\repetytor-iz-komi
```

Далее выполните по очереди:

```powershell
# 1. Инициализировать git-репозиторий в папке
git init

# 2. Подключить ваш репозиторий на GitHub (замените адрес на свой!)
git remote add origin https://github.com/ВАШ_ЛОГИН/repetytor-iz-komi.git

# 3. Добавить все файлы (уважая .gitignore — node_modules и .env не попадут)
git add .

# 4. Создать первый коммит
git commit -m "Первый коммит: фронтенд + бэкенд платформы"

# 5. Переименовать ветку в main (стандарт GitHub)
git branch -M main

# 6. Отправить код на GitHub
git push -u origin main
```

При первом `git push` GitHub попросит авторизоваться. Если откроется окно
браузера — просто подтвердите вход. Если терминал спросит логин/пароль —
вместо пароля используйте **Personal Access Token** (см. Шаг 4).

---

## Шаг 4. Если спросит пароль — создайте токен (Personal Access Token)

GitHub давно не принимает обычные пароли в терминале. Нужен токен:

1. На GitHub: **аватар → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic)**.
2. Note: `repetytor-iz-komi`, срок — 90 дней или No expiration.
3. Отметьте галочку **repo** (полный доступ к репозиториям).
4. Нажмите «Generate token» и **сразу скопируйте** токен (он показывается один раз).
5. В терминале:
   - Username: ваш логин GitHub
   - Password: вставьте токен

Чтобы не вводить токен каждый раз, включите кэш:

```powershell
git config --global credential.helper manager
```

(на Windows обычно уже включён по умолчанию — тогда Windows запомнит токен в
«Диспетчере учётных данных»)

---

## Шаг 5. Проверить

Откройте `https://github.com/ВАШ_ЛОГИН/repetytor-iz-komi` — там должны быть:

```
├── src/                  ← фронтенд (React + TS)
│   └── product/          ← вся продуктовая логика
├── backend/              ← FastAPI + SQLAlchemy
│   └── app/
├── index.html
├── package.json
├── .gitignore
├── GITHUB_SETUP.md
└── ...
```

**Чего быть НЕ должно:** `node_modules/`, `dist/`, `.env`, `backend/.env`.
Если они попали — значит `.gitignore` не сработал (напишите, починим).

---

## Шаг 6. Обновлять проект в будущем

Каждый раз, когда мы с вами что-то меняем и вы скачиваете свежий код,
обновление на GitHub делается тремя командами:

```powershell
cd C:\Users\ВашеИмя\Projects\repetytor-iz-komi
git add .
git commit -m "Описание изменений (например: добавил марафон и титулы)"
git push
```

---

## Шаг 7. Восстановление после сброса песочницы

Если песочница сбросилась и проект «пропал»:

```powershell
# склонировать ваш репозиторий в любую папку
git clone https://github.com/ВАШ_ЛОГИН/repetytor-iz-komi.git
cd repetytor-iz-komi

# поставить зависимости и запустить
npm install
npm run dev
```

Всё — сайт снова работает, ничего не потеряно. **Именно ради этого мы и
заливаем код на GitHub.**

---

## Бонус: запуск на VPS (когда купите домен)

Коротко, подробнее обсудим отдельно:

1. Арендуйте VPS (Timeweb Cloud / Beget / Selectel, 1 ГБ+, Ubuntu 22.04).
2. На сервере:
   ```bash
   sudo apt update && sudo apt install -y git nodejs npm
   git clone https://github.com/ВАШ_ЛОГИН/repetytor-iz-komi.git
   cd repetytor-iz-komi
   npm install && npm run build
   ```
3. Домен → A-запись на IP сервера, Nginx + certbot (SSL).
4. Бэкенд — через `backend/` + PostgreSQL (или Docker).

---

## Частые вопросы

**Q: Репозиторий приватный — сайт будет работать?**
A: Да. Приватность влияет только на видимость кода, не на работу сайта.

**Q: Можно сделать публичным, чтобы показать коллегам код?**
A: Да, Settings → General → «Change repository visibility». Но сначала убедитесь,
что в `.env` нет реальных паролей (они и так не коммитятся благодаря `.gitignore`).

**Q: Я случайно закоммитил `.env` с паролем. Что делать?**
A: Напишите мне — уберём его из истории git и отзовём пароль.
