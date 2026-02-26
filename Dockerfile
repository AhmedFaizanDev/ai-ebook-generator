# syntax=docker/dockerfile:1.4
# ── Stage 1: Install dependencies ──────────────────────────────────────────────
FROM node:20-slim AS deps

WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

# ── Stage 2: Build API (backend only; no frontend build) ───────────────────────
FROM deps AS build-api

WORKDIR /app
COPY apps/api apps/api
ENV NODE_OPTIONS="--max-old-space-size=1536"
RUN npm run build:api

# ── Stage 3: Production image (API + batch CLI only) ───────────────────────────
FROM node:20-slim AS runner

# Puppeteer dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_DOCKER=true
ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts

# Copy built API
COPY --from=build-api /app/apps/api/dist apps/api/dist
COPY --from=build-api /app/apps/api/package.json apps/api/package.json

# Copy batch CLI source (runs via tsx at runtime)
COPY apps/api/src apps/api/src
COPY apps/api/tsconfig.json apps/api/tsconfig.json

RUN mkdir -p /app/apps/api/.sessions

EXPOSE 4000

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["api"]
