#!/bin/sh
# Container start-up: wait for Postgres and apply migrations, then serve.
# The server seeds the skill taxonomy and admin account on start
# (src/instrumentation.ts). Everything here is idempotent.
set -e

echo "> Applying database migrations"
attempt=1
until (cd /app/migrate && ./node_modules/.bin/prisma migrate deploy); do
  if [ "$attempt" -ge 30 ]; then
    echo "x Database not reachable after $attempt attempts" >&2
    exit 1
  fi
  echo "  database not ready (attempt $attempt), retrying in 2s"
  attempt=$((attempt + 1))
  sleep 2
done

echo "> Starting Turan Math on port ${PORT:-3000}"
exec node /app/server.js
