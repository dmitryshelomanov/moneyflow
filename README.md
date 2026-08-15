# MoneyFlow

Личный учёт денег: Telegram-бот (текст / фото чека / скрин списка трат) → RouterAI → SQLite → веб-дашборд.

## Стек

- `apps/api` — Hono + Drizzle + SQLite + grammY
- `apps/web` — React + Vite + Tailwind + Recharts (glass UI)
- `packages/shared` — Zod-схемы

## Быстрый старт

```bash
cp .env.example .env
# заполни ACCESS_KEY, SESSION_SECRET; для бота — TELEGRAM_BOT_TOKEN, ALLOWED_TELEGRAM_IDS
# для AI — ROUTERAI_API_KEY

npm install
npm run build -w @moneyflow/shared
npm run dev:api
npm run dev:web
```

Открой: `http://localhost:5173/k/<ACCESS_KEY>/`

В dev без Telegram widget есть кнопка «Войти (dev)».

`WEB_ORIGIN` попадает в приветствие бота (`/start`) как ссылка на веб. На VPS поставь туда публичный URL, например `https://money.example.com`.

## Авторизация

Два слоя: скрытый URL + вход через Telegram (whitelist).

```text
  Браузер
     │
     ▼
  /k/<ACCESS_KEY>/          ← без ключа = 404 (сайт «не существует»)
     │
     ▼
  Login page
     │
     ├─ Production: Telegram Login Widget
     │     → POST /auth/telegram
     │     → проверка hash бот-токеном
     │     → id ∈ ALLOWED_TELEGRAM_IDS
     │
     └─ Development: кнопка «Войти (dev)»
           → POST /auth/dev-login
           → id из whitelist (или 1)
     │
     ▼
  Cookie mf_session (HttpOnly, 30 дней, HMAC через SESSION_SECRET)
     │
     ▼
  Dashboard / API — каждый запрос с cookie
     нет cookie / чужой id → 401
```

| Шаг          | Что происходит                                                       |
| ------------ | -------------------------------------------------------------------- |
| 1. URL       | Нужен `ACCESS_KEY` в пути. Один ключ на весь проект — общая «дверь». |
| 2. Логин     | Telegram подтверждает личность (или dev-login локально).             |
| 3. Whitelist | Входят только `user_id` из `ALLOWED_TELEGRAM_IDS`.                   |
| 4. Сессия    | Сервер ставит подписанную cookie `mf_session`.                       |
| 5. API       | Без валидной cookie данные не отдаются. «Выйти» удаляет cookie.      |

Бот использует тот же whitelist: посторонним отвечает «Доступ закрыт».

Для Telegram Login на вебе задай `VITE_TELEGRAM_BOT_USERNAME` (без `@`) и в [BotFather](https://t.me/BotFather) привяжи домен к Login Widget.

## API

Базовый префикс:

```text
/k/<ACCESS_KEY>/api/...
```

Почти все ручки (кроме login / me / logout) требуют cookie `mf_session`.

### Служебные

| Метод | Путь      | Описание                       |
| ----- | --------- | ------------------------------ |
| `GET` | `/health` | Healthcheck **без** access key |

### Auth

| Метод  | Путь                  | Auth            | Описание                               |
| ------ | --------------------- | --------------- | -------------------------------------- |
| `POST` | `/api/auth/telegram`  | —               | Вход через Telegram Login Widget       |
| `POST` | `/api/auth/dev-login` | —               | Dev-вход (`NODE_ENV=development` only) |
| `POST` | `/api/auth/logout`    | —               | Удалить cookie                         |
| `GET`  | `/api/auth/me`        | cookie optional | Текущий пользователь или `null`        |

### Settings

| Метод   | Путь            | Описание                                    |
| ------- | --------------- | ------------------------------------------- |
| `GET`   | `/api/settings` | Валюта, стартовый баланс, промпт, модель AI |
| `PATCH` | `/api/settings` | Обновить настройки                          |

### Categories

| Метод    | Путь                    | Описание                       |
| -------- | ----------------------- | ------------------------------ |
| `GET`    | `/api/categories?type=` | Список (`expense` \| `income`) |
| `POST`   | `/api/categories`       | Создать                        |
| `PATCH`  | `/api/categories/:id`   | Обновить                       |
| `DELETE` | `/api/categories/:id`   | Удалить                        |

### Transactions

| Метод    | Путь                    | Описание                                                                                                                |
| -------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/transactions`     | Список страницами. Query: `from`, `to`, `type`, `categoryId`, `limit`, `cursor`; ответ `{ items, nextCursor, hasMore }` |
| `GET`    | `/api/transactions/:id` | Одна операция                                                                                                           |
| `POST`   | `/api/transactions`     | Создать вручную                                                                                                         |
| `PATCH`  | `/api/transactions/:id` | Изменить                                                                                                                |
| `DELETE` | `/api/transactions/:id` | Удалить                                                                                                                 |

### Stats

| Метод | Путь                                         | Описание                                             |
| ----- | -------------------------------------------- | ---------------------------------------------------- |
| `GET` | `/api/stats/summary?from&to`                 | Баланс, доход/расход периода, разбивка по категориям |
| `GET` | `/api/stats/timeseries?from&to&granularity=` | Ряд: `day` \| `week` \| `month`                      |

### AI parse

| Метод  | Путь         | Описание                                                                                                                      |
| ------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/parse` | Разобрать текст и/или изображение. Body: `{ text?, imageBase64?, imageMime?, save? }`. `save: false` — только JSON без записи |

Код ручек: [`apps/api/src/routes/api.ts`](apps/api/src/routes/api.ts)

### Примеры

```bash
KEY=your-access-key
BASE=http://localhost:3000/k/$KEY/api

# Dev-логин (сохраняет cookie в jar)
curl -c cookies.txt -X POST "$BASE/auth/dev-login" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Dev"}'

# Сводка
curl -b cookies.txt "$BASE/stats/summary"

# Быстрая запись через AI
curl -b cookies.txt -X POST "$BASE/parse" \
  -H 'Content-Type: application/json' \
  -d '{"text":"кофе 350"}'
```

## Env

| Переменная                   | Описание                                              |
| ---------------------------- | ----------------------------------------------------- |
| `ACCESS_KEY`                 | Секретный кусок URL (см. ниже)                        |
| `SESSION_SECRET`             | Ключ подписи cookie-сессии (см. ниже)                 |
| `TELEGRAM_BOT_TOKEN`         | Токен бота                                            |
| `ALLOWED_TELEGRAM_IDS`       | Whitelist Telegram user id через запятую              |
| `ROUTERAI_API_KEY`           | Ключ [RouterAI](https://routerai.ru/)                 |
| `ROUTERAI_MODEL`             | Модель с vision, напр. `openai/gpt-4o`                |
| `DATABASE_PATH`              | Путь к SQLite                                         |
| `PORT`                       | Порт API                                              |
| `WEB_ORIGIN`                 | Origin фронта для CORS (dev: `http://localhost:5173`) |
| `VITE_TELEGRAM_BOT_USERNAME` | Username бота без `@` для Login Widget                |

### Что делают `ACCESS_KEY` и `SESSION_SECRET`

**`ACCESS_KEY`** — «невидимая дверь» в URL.

- Приложение открывается только по адресу вида  
  `https://твой-домен/k/<ACCESS_KEY>/`  
  (локально: `http://localhost:5173/k/<ACCESS_KEY>/`).
- API тоже живёт под тем же префиксом: `/k/<ACCESS_KEY>/api/...`.
- Неверный ключ → `404`. Случайный человек с доменом без ключа сайт не увидит.
- Это не полноценный пароль, а скрытие URL. Вместе с Telegram whitelist этого достаточно для личного проекта.
- В production поставь длинную случайную строку (16+ символов) и никому не свети ссылку.

**`SESSION_SECRET`** — секрет для подписи cookie после логина.

- После входа через Telegram (или dev-login) сервер кладёт HttpOnly cookie `mf_session`.
- Cookie подписана HMAC с этим секретом: подделать сессию без него нельзя.
- Если сменить `SESSION_SECRET` — все текущие сессии сразу станут невалидны (нужен повторный вход).
- В production тоже длинная случайная строка, **другая**, чем `ACCESS_KEY`.

Пример генерации:

```bash
openssl rand -hex 16   # ACCESS_KEY
openssl rand -hex 32   # SESSION_SECRET
```

## Деплой на VPS

```bash
npm install
npm run build
NODE_ENV=production npm start
```

Поставь nginx / caddy reverse-proxy на порт `PORT`. Бот стартует polling в том же процессе.

Домен: `https://your.domain/k/<ACCESS_KEY>/`

## Возможности MVP

- Парсинг текста, чеков и скринов истории банка (фото не хранится; список → N операций, чек → одна)
- Категории с Lucide-иконкой и опциональным промптом
- Глобальный промпт категоризации в настройках
- Баланс = стартовый + доходы − расходы
- Графики доходов/расходов и структура трат
- Фильтры операций по датам / типу / категории
