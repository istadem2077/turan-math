# syntax=docker/dockerfile:1
# Turan Math production image. Built and started by docker-compose.yml.
#
# The runtime holds only the Next.js standalone server plus the Prisma CLI
# (used once per start for `migrate deploy`). The server seeds the skill
# taxonomy and admin account itself on start-up (src/instrumentation.ts).

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ── Build ──
FROM base AS build
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# `prisma generate` (postinstall) requires DATABASE_URL to be set but never connects.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npm ci
COPY . .
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time.
ARG NEXT_PUBLIC_DESMOS_API_KEY=dcb31709b452b1cf9dc26972add0fda6
ENV NEXT_PUBLIC_DESMOS_API_KEY=$NEXT_PUBLIC_DESMOS_API_KEY
RUN npm run build

# ── Prisma CLI for migrations (same versions as package-lock.json) ──
FROM base AS migrator
WORKDIR /migrate
COPY package-lock.json ./
RUN PRISMA_VERSION=$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version") \
 && DOTENV_VERSION=$(node -p "require('./package-lock.json').packages['node_modules/dotenv'].version") \
 && rm package-lock.json \
 && npm init -y > /dev/null \
 && npm install --omit=dev --no-audit --no-fund "prisma@$PRISMA_VERSION" "dotenv@$DOTENV_VERSION" \
 && npm cache clean --force

# ── Runtime ──
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=migrator --chown=app:app /migrate/node_modules ./migrate/node_modules
COPY --chown=app:app prisma.config.ts ./migrate/
COPY --chown=app:app prisma/schema.prisma ./migrate/prisma/
COPY --chown=app:app prisma/migrations ./migrate/prisma/migrations
COPY --chown=app:app docker/entrypoint.sh ./docker/entrypoint.sh
USER app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/login" || exit 1
ENTRYPOINT ["/bin/sh", "/app/docker/entrypoint.sh"]
