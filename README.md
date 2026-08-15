# MoneyFlow

Personal money tracker: Telegram bot (text / receipt photo / bank history screenshot) → RouterAI → SQLite → web dashboard.

## Screenshots

Demo DB only (fictional amounts and merchants, no personal data).

<p align="center">
  <img src="docs/screenshots/dashboard.png" width="32%" alt="Dashboard" />
  <img src="docs/screenshots/transactions.png" width="32%" alt="Transactions" />
  <img src="docs/screenshots/categories.png" width="32%" alt="Categories" />
</p>

## Stack

- `apps/api` — Hono + Drizzle + SQLite + grammY
- `apps/web` — React + Vite + Tailwind + Recharts (glass UI)
- `packages/shared` — Zod schemas

## Quick start

```bash
cp .env.example .env
# fill ACCESS_KEY, SESSION_SECRET; for the bot — TELEGRAM_BOT_TOKEN, ALLOWED_TELEGRAM_IDS
# for AI — ROUTERAI_API_KEY

npm install
npm run build -w @moneyflow/shared
npm run dev:api
npm run dev:web
```

Open: `http://localhost:5173/k/<ACCESS_KEY>/`

In development (no Telegram widget) use the **Sign in (dev)** button.

`WEB_ORIGIN` is used in the bot `/start` greeting as the web link. On a VPS set it to your public URL, e.g. `https://money.example.com`.

## Auth

Two layers: hidden URL + Telegram login (whitelist).

```text
  Browser
     │
     ▼
  /k/<ACCESS_KEY>/          ← wrong/missing key = 404 (site “does not exist”)
     │
     ▼
  Login page
     │
     ├─ Production: Telegram Login Widget
     │     → POST /auth/telegram
     │     → hash check with bot token
     │     → id ∈ ALLOWED_TELEGRAM_IDS
     │
     └─ Development: “Sign in (dev)” button
           → POST /auth/dev-login
           → id from whitelist (or 1)
     │
     ▼
  Cookie mf_session (HttpOnly, 30 days, HMAC via SESSION_SECRET)
     │
     ▼
  Dashboard / API — every request needs the cookie
     missing cookie / foreign id → 401
```

| Step         | What happens                                                              |
| ------------ | ------------------------------------------------------------------------- |
| 1. URL       | `ACCESS_KEY` must be in the path. One shared key for the whole project.   |
| 2. Login     | Telegram proves identity (or dev-login locally).                          |
| 3. Whitelist | Only `user_id`s from `ALLOWED_TELEGRAM_IDS` can enter.                    |
| 4. Session   | Server sets a signed `mf_session` cookie.                                 |
| 5. API       | No valid cookie → no data. Logout clears the cookie.                      |

The bot uses the same whitelist: outsiders get “Access denied”.

For Telegram Login on the web, set `VITE_TELEGRAM_BOT_USERNAME` (without `@`) and attach your domain to the Login Widget in [BotFather](https://t.me/BotFather).

## API

Base prefix:

```text
/k/<ACCESS_KEY>/api/...
```

Almost every route (except login / me / logout) requires the `mf_session` cookie.

### Ops

| Method | Path      | Description                         |
| ------ | --------- | ----------------------------------- |
| `GET`  | `/health` | Healthcheck **without** access key  |

### Auth

| Method | Path                  | Auth            | Description                              |
| ------ | --------------------- | --------------- | ---------------------------------------- |
| `POST` | `/api/auth/telegram`  | —               | Sign in via Telegram Login Widget        |
| `POST` | `/api/auth/dev-login` | —               | Dev sign-in (`NODE_ENV=development` only)|
| `POST` | `/api/auth/logout`    | —               | Clear cookie                             |
| `GET`  | `/api/auth/me`        | cookie optional | Current user or `null`                   |

### Settings

| Method  | Path            | Description                                   |
| ------- | --------------- | --------------------------------------------- |
| `GET`   | `/api/settings` | Currency, opening balance, prompt, AI model   |
| `PATCH` | `/api/settings` | Update settings                               |

### Categories

| Method   | Path                    | Description                    |
| -------- | ----------------------- | ------------------------------ |
| `GET`    | `/api/categories?type=` | List (`expense` \| `income`)   |
| `POST`   | `/api/categories`       | Create                         |
| `PATCH`  | `/api/categories/:id`   | Update                         |
| `DELETE` | `/api/categories/:id`   | Delete                         |

### Transactions

| Method   | Path                    | Description                                                                                                              |
| -------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `GET`    | `/api/transactions`     | Paginated list. Query: `from`, `to`, `type`, `categoryId`, `limit`, `cursor`; response `{ items, nextCursor, hasMore }` |
| `GET`    | `/api/transactions/:id` | Single transaction                                                                                                       |
| `POST`   | `/api/transactions`     | Create manually                                                                                                          |
| `PATCH`  | `/api/transactions/:id` | Update                                                                                                                   |
| `DELETE` | `/api/transactions/:id` | Delete                                                                                                                   |

### Stats

| Method | Path                                         | Description                                              |
| ------ | -------------------------------------------- | -------------------------------------------------------- |
| `GET`  | `/api/stats/summary?from&to`                 | Balance, period income/expense, category breakdown       |
| `GET`  | `/api/stats/timeseries?from&to&granularity=` | Series: `day` \| `week` \| `month`                       |

### AI parse

| Method | Path         | Description                                                                                                                       |
| ------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/parse` | Parse text and/or image. Body: `{ text?, imageBase64?, imageMime?, save? }`. `save: false` — JSON only, no write                  |

Route code: [`apps/api/src/routes/api.ts`](apps/api/src/routes/api.ts)

### Examples

```bash
KEY=your-access-key
BASE=http://localhost:3000/k/$KEY/api

# Dev login (stores cookie in jar)
curl -c cookies.txt -X POST "$BASE/auth/dev-login" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Dev"}'

# Summary
curl -b cookies.txt "$BASE/stats/summary"

# Quick entry via AI
curl -b cookies.txt -X POST "$BASE/parse" \
  -H 'Content-Type: application/json' \
  -d '{"text":"coffee 350"}'
```

## Env

| Variable                     | Description                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `ACCESS_KEY`                 | Secret URL segment (see below)                                                |
| `SESSION_SECRET`             | Cookie signing key (see below)                                                |
| `TELEGRAM_BOT_TOKEN`         | Bot token                                                                     |
| `ALLOWED_TELEGRAM_IDS`       | Comma-separated Telegram user id whitelist                                    |
| `ROUTERAI_API_KEY`           | [RouterAI](https://routerai.ru/) key                                          |
| `ROUTERAI_MODEL`             | Vision-capable model, e.g. `openai/gpt-4o`                                    |
| `DATABASE_PATH`              | SQLite path                                                                   |
| `PORT`                       | API port                                                                      |
| `WEB_ORIGIN`                 | CORS origin + bot link (dev: `http://localhost:5173`, VPS by IP: `http://x.x.x.x`) |
| `VITE_TELEGRAM_BOT_USERNAME` | Bot username without `@` for Login Widget (needs domain + HTTPS; unused on bare IP) |

### What `ACCESS_KEY` and `SESSION_SECRET` do

**`ACCESS_KEY`** — an “invisible door” in the URL.

- The app only opens at  
  `http://x.x.x.x/k/<ACCESS_KEY>/` (or a domain once you have one)  
  (local: `http://localhost:5173/k/<ACCESS_KEY>/`).
- The API lives under the same prefix: `/k/<ACCESS_KEY>/api/...`.
- Wrong key → `404`. Someone who only knows the host never sees the site.
- Not a full password — URL obscurity. Together with the Telegram whitelist this is enough for a personal project.
- In production use a long random string (16+ chars) and don’t share the link.

**`SESSION_SECRET`** — secret used to sign the cookie after login.

- After Telegram login (or dev-login) the server sets an HttpOnly `mf_session` cookie.
- The cookie is HMAC-signed with this secret: forging a session without it is not possible.
- Changing `SESSION_SECRET` invalidates all current sessions (users must sign in again).
- In production use another long random string, **different** from `ACCESS_KEY`.

Generate examples:

```bash
openssl rand -hex 16   # ACCESS_KEY
openssl rand -hex 32   # SESSION_SECRET
```

## Deploy on a VPS

Deployed via GitHub Actions: push to `main` → rsync to VPS → `docker compose up -d --build` (app + Caddy on **HTTP :80**, no TLS).

Public URL: `http://<SERVER_IP>/k/<ACCESS_KEY>/`  
Healthcheck: `http://<SERVER_IP>/health`

### Once on the VPS

1. Ubuntu/Debian, Docker + Compose plugin, port **80** open.
2. Deploy user with an SSH key (public key in `~/.ssh/authorized_keys`).
3. Directory, e.g. `/opt/moneyflow` (created by the workflow).

### GitHub Secrets

**Deploy**

| Secret | Example |
| ------ | ------- |
| `DEPLOY_HOST` | Server IP |
| `DEPLOY_USER` | `root` or `deploy` |
| `DEPLOY_SSH_KEY` | Deploy private key |
| `DEPLOY_PATH` | `/opt/moneyflow` |

**App** (workflow writes `.env` on the server)

| Secret | Required |
| ------ | -------- |
| `WEB_ORIGIN` | `http://x.x.x.x` (same as public IP) |
| `ACCESS_KEY` | yes (≥8) |
| `SESSION_SECRET` | yes (≥8) |
| `TELEGRAM_BOT_TOKEN` | for the bot |
| `ALLOWED_TELEGRAM_IDS` | whitelist |
| `VITE_TELEGRAM_BOT_USERNAME` | optional on bare IP (Login Widget won’t work) |
| `ROUTERAI_API_KEY` | for AI |
| `ROUTERAI_BASE_URL` / `ROUTERAI_MODEL` | optional |

`NODE_ENV`, `PORT`, `DATABASE_PATH` are set in compose/workflow.

### Auth without a domain

| Channel | Works on bare IP? |
| ------- | ----------------- |
| Telegram bot (chat) | Yes |
| Web Telegram Login Widget | No (needs hostname in BotFather + usually HTTPS) |
| Dev-login | No in `NODE_ENV=production` |

Use the **bot** until you have a domain and switch Caddy to TLS.

### Locally without GitHub

```bash
cp .env.example .env
# ACCESS_KEY, SESSION_SECRET, WEB_ORIGIN=http://x.x.x.x, …
docker compose up -d --build
```

Manual start without Docker:

```bash
npm install
npm run build
NODE_ENV=production npm start
```

The bot starts polling in the same process as the API.

## MVP features

- Parse text, receipts, and bank history screenshots (photos are not stored; list → N transactions, receipt → one)
- Categories with a Lucide icon and an optional prompt
- Global categorization prompt in settings
- Balance = opening + income − expenses
- Income/expense charts and spend structure
- Transaction filters by date / type / category
