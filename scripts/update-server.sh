#!/usr/bin/env bash
# Production update: pull, install deps, migrate, build, PM2 restart.
# See docs/deploy-runbook.md §11.
set -euo pipefail

ROOT="${EXTENSILICA_ROOT:-/opt/extensilica}"
BRANCH="${GIT_BRANCH:-main}"

if [[ ! -d "$ROOT/.git" ]]; then
  echo "error: $ROOT is not a git clone (set EXTENSILICA_ROOT)" >&2
  exit 1
fi

cd "$ROOT"
echo "==> git pull origin $BRANCH"
git pull origin "$BRANCH"

echo "==> store-backend: npm ci, prisma, build, pm2"
cd "$ROOT/store-backend"
npm ci
npx prisma generate
npx prisma migrate deploy
npm run backfill:ports
npm run build
pm2 restart extensilica-api

echo "==> store-frontend: npm ci, build, pm2"
cd "$ROOT/store-frontend"
npm ci
npm run build
pm2 restart extensilica-web

echo "==> done. Check: pm2 status && pm2 logs extensilica-api --lines 30"
