# syntax=docker/dockerfile:1

FROM node:20-bookworm AS builder

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

RUN npm ci

COPY . .

ARG ACCESS_KEY
ARG VITE_TELEGRAM_BOT_USERNAME=
ENV ACCESS_KEY=$ACCESS_KEY
ENV VITE_TELEGRAM_BOT_USERNAME=$VITE_TELEGRAM_BOT_USERNAME
ENV NODE_ENV=production

RUN test -n "$ACCESS_KEY" || (echo "ACCESS_KEY build-arg is required" && exit 1)
RUN npm run build

FROM node:20-bookworm-slim AS runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=./data/moneyflow.db

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/packages ./packages

EXPOSE 3000

CMD ["npm", "start"]
