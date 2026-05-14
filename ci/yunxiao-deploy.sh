#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="${1:?missing source dir}"
APP_DIR="${APP_DIR:-/opt/listingfy}"
DATABASE_URL_VALUE="${PROD_DATABASE_URL:-${DATABASE_URL:-}}"
ALLOWED_ORIGINS="${LISTINGIFY_ALLOWED_ORIGINS:-http://10.90.20.221,http://127.0.0.1:3001,http://localhost:3001}"

if [ -z "$DATABASE_URL_VALUE" ]; then
  echo "ERROR: PROD_DATABASE_URL is required. Configure it as a Yunxiao secret variable."
  exit 10
fi

echo "===== Listingify Yunxiao deploy ====="
echo "SRC_DIR=$SRC_DIR"
echo "APP_DIR=$APP_DIR"
test -f "$SRC_DIR/package.json"
test -d "$SRC_DIR/web"

mkdir -p "$APP_DIR"

rsync -a --delete "$SRC_DIR"/ "$APP_DIR"/ \
  --exclude='.env.local' \
  --exclude='node_modules' \
  --exclude='web/node_modules'

cd "$APP_DIR"

echo "===== Write production env ====="
{
  printf 'DATABASE_PROVIDER=postgres\n'
  printf 'DATABASE_URL=%s\n' "$DATABASE_URL_VALUE"
  printf 'DATABASE_POOL_MAX=%s\n' "${DATABASE_POOL_MAX:-10}"
  printf 'DATABASE_CONNECT_TIMEOUT_MS=%s\n' "${DATABASE_CONNECT_TIMEOUT_MS:-3000}"
  printf 'DATABASE_IDLE_TIMEOUT_MS=%s\n' "${DATABASE_IDLE_TIMEOUT_MS:-30000}"
  printf 'LISTINGIFY_ALLOWED_ORIGINS=%s\n' "$ALLOWED_ORIGINS"
  printf 'NODE_ENV=production\n'
  printf 'PORT=%s\n' "${PORT:-3001}"
  [ -n "${LISTINGIFY_CREDENTIAL_SECRET:-}" ] && printf 'LISTINGIFY_CREDENTIAL_SECRET=%s\n' "$LISTINGIFY_CREDENTIAL_SECRET"
  [ -n "${SHEIN_BASE_URL:-}" ] && printf 'SHEIN_BASE_URL=%s\n' "$SHEIN_BASE_URL"
  [ -n "${SHEIN_LANGUAGE:-}" ] && printf 'SHEIN_LANGUAGE=%s\n' "$SHEIN_LANGUAGE"
  [ -n "${SHEIN_OPEN_KEY_ID:-}" ] && printf 'SHEIN_OPEN_KEY_ID=%s\n' "$SHEIN_OPEN_KEY_ID"
  [ -n "${SHEIN_SECRET_KEY:-}" ] && printf 'SHEIN_SECRET_KEY=%s\n' "$SHEIN_SECRET_KEY"
  [ -n "${MDM_BASE_URL:-}" ] && printf 'MDM_BASE_URL=%s\n' "$MDM_BASE_URL"
  [ -n "${MDM_APP_ID:-}" ] && printf 'MDM_APP_ID=%s\n' "$MDM_APP_ID"
  [ -n "${MDM_APP_KEY:-}" ] && printf 'MDM_APP_KEY=%s\n' "$MDM_APP_KEY"
  [ -n "${DEEPDRAW_BASE_URL:-}" ] && printf 'DEEPDRAW_BASE_URL=%s\n' "$DEEPDRAW_BASE_URL"
  [ -n "${DEEPDRAW_TENANT_NAME:-}" ] && printf 'DEEPDRAW_TENANT_NAME=%s\n' "$DEEPDRAW_TENANT_NAME"
  [ -n "${DEEPDRAW_APP_KEY:-}" ] && printf 'DEEPDRAW_APP_KEY=%s\n' "$DEEPDRAW_APP_KEY"
  [ -n "${DEEPDRAW_APP_SECRET:-}" ] && printf 'DEEPDRAW_APP_SECRET=%s\n' "$DEEPDRAW_APP_SECRET"
  [ -n "${DEEPDRAW_DOP_KEY:-}" ] && printf 'DEEPDRAW_DOP_KEY=%s\n' "$DEEPDRAW_DOP_KEY"
  [ -n "${DEEPDRAW_MERCHANT_ID:-}" ] && printf 'DEEPDRAW_MERCHANT_ID=%s\n' "$DEEPDRAW_MERCHANT_ID"
  [ -n "${AI_BASE_URL:-}" ] && printf 'AI_BASE_URL=%s\n' "$AI_BASE_URL"
  [ -n "${AI_MODEL:-}" ] && printf 'AI_MODEL=%s\n' "$AI_MODEL"
  [ -n "${AI_API_KEY:-}" ] && printf 'AI_API_KEY=%s\n' "$AI_API_KEY"
} > .env.local

echo "===== Check runtime ====="
node -v
npm -v
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 24 ]; then
  echo "ERROR: Listingify requires Node >=24. Install Node 24 on this server, then rerun."
  exit 20
fi

echo "===== Install dependencies ====="
npm --prefix web ci

echo "===== Build web ====="
npm --prefix web run build

echo "===== Migrate and seed database ====="
npm run db:migrate
npm run seed:import

echo "===== Restart API ====="
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

pm2 delete listingfy-api || true
pm2 start ./web/node_modules/.bin/tsx --name listingfy-api -- web/server/index.ts
pm2 save

echo "===== Health check ====="
sleep 3
curl -fsS "http://127.0.0.1:${PORT:-3001}/api/health"
echo
echo "DEPLOY_OK"
