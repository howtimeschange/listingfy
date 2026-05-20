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
  [ -n "${LISTINGIFY_ADMIN_USERNAME:-}" ] && printf 'LISTINGIFY_ADMIN_USERNAME=%s\n' "$LISTINGIFY_ADMIN_USERNAME"
  [ -n "${LISTINGIFY_ADMIN_PASSWORD:-}" ] && printf 'LISTINGIFY_ADMIN_PASSWORD=%s\n' "$LISTINGIFY_ADMIN_PASSWORD"
  [ -n "${LISTINGIFY_ADMIN_DISPLAY_NAME:-}" ] && printf 'LISTINGIFY_ADMIN_DISPLAY_NAME=%s\n' "$LISTINGIFY_ADMIN_DISPLAY_NAME"
  [ -n "${LISTINGIFY_CREDENTIAL_SECRET:-}" ] && printf 'LISTINGIFY_CREDENTIAL_SECRET=%s\n' "$LISTINGIFY_CREDENTIAL_SECRET"
  [ -n "${LISTINGIFY_LOGIN_MAX_FAILURES:-}" ] && printf 'LISTINGIFY_LOGIN_MAX_FAILURES=%s\n' "$LISTINGIFY_LOGIN_MAX_FAILURES"
  [ -n "${LISTINGIFY_LOGIN_LOCK_MINUTES:-}" ] && printf 'LISTINGIFY_LOGIN_LOCK_MINUTES=%s\n' "$LISTINGIFY_LOGIN_LOCK_MINUTES"
  [ -n "${PRODUCT_ARCHIVE_SYNC_INTERVAL_MS:-}" ] && printf 'PRODUCT_ARCHIVE_SYNC_INTERVAL_MS=%s\n' "$PRODUCT_ARCHIVE_SYNC_INTERVAL_MS"
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
  [ -n "${DEEPDRAW_TENANT_CREDENTIALS_JSON:-}" ] && printf 'DEEPDRAW_TENANT_CREDENTIALS_JSON=%s\n' "$DEEPDRAW_TENANT_CREDENTIALS_JSON"
  [ -n "${DEEPDRAW_TIMEOUT_MS:-}" ] && printf 'DEEPDRAW_TIMEOUT_MS=%s\n' "$DEEPDRAW_TIMEOUT_MS"
  [ -n "${AI_BASE_URL:-}" ] && printf 'AI_BASE_URL=%s\n' "$AI_BASE_URL"
  [ -n "${AI_MODEL:-}" ] && printf 'AI_MODEL=%s\n' "$AI_MODEL"
  [ -n "${AI_API_KEY:-}" ] && printf 'AI_API_KEY=%s\n' "$AI_API_KEY"
  [ -n "${AI_TIMEOUT_MS:-}" ] && printf 'AI_TIMEOUT_MS=%s\n' "$AI_TIMEOUT_MS"
} > .env.local

echo "===== Check runtime ====="
HOST_NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
  node -v
  npm -v
  HOST_NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
fi

if [ "$HOST_NODE_MAJOR" -ge 24 ]; then
  echo "===== Install dependencies on host ====="
  npm --prefix web ci --include=dev

  echo "===== Build web on host ====="
  npm --prefix web run build

  echo "===== Migrate database on host ====="
  npm run db:migrate
  if [ "${RUN_SEED_IMPORT:-0}" = "1" ]; then
    echo "===== Import seed data on host ====="
    npm run seed:import
  else
    echo "===== Skip seed import; set RUN_SEED_IMPORT=1 to enable ====="
  fi

  echo "===== Restart API with pm2 ====="
  if ! command -v pm2 >/dev/null 2>&1; then
    npm install -g pm2
  fi

  pm2 delete listingfy-api || true
  pm2 start ./web/node_modules/.bin/tsx --name listingfy-api -- web/server/index.ts
  pm2 save
else
  echo "Host Node >=24 is unavailable; deploying with Docker Node runtime."
  if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: Docker is required on CentOS 7 because Node 24 requires glibc >= 2.28 on host."
    echo "Install Docker, then rerun this pipeline."
    exit 21
  fi

  NODE_IMAGE="${LISTINGIFY_NODE_IMAGE:-node:24-bookworm}"
  echo "Using Docker image: $NODE_IMAGE"

  docker run --rm --network host \
    -v "$APP_DIR:/app" \
    -w /app \
    --env-file "$APP_DIR/.env.local" \
    -e RUN_SEED_IMPORT="${RUN_SEED_IMPORT:-0}" \
    "$NODE_IMAGE" \
    bash -lc 'set -e; node -v; npm -v; npm --prefix web ci --include=dev; npm --prefix web run build; npm run db:migrate; if [ "${RUN_SEED_IMPORT:-0}" = "1" ]; then echo "===== Import seed data in Docker ====="; npm run seed:import; else echo "===== Skip seed import; set RUN_SEED_IMPORT=1 to enable ====="; fi'

  echo "===== Restart API container ====="
  docker rm -f listingfy-api >/dev/null 2>&1 || true
  docker run -d \
    --name listingfy-api \
    --restart unless-stopped \
    --network host \
    -v "$APP_DIR:/app" \
    -w /app \
    --env-file "$APP_DIR/.env.local" \
    "$NODE_IMAGE" \
    bash -lc './web/node_modules/.bin/tsx web/server/index.ts'
fi

echo "===== Health check ====="
sleep 3
curl -fsS "http://127.0.0.1:${PORT:-3001}/api/health"
echo

echo "===== Restart web container ====="
if command -v docker >/dev/null 2>&1; then
  test -f "$APP_DIR/web/dist/index.html"
  cat > "$APP_DIR/nginx.conf" <<'NGINXEOF'
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    client_max_body_size 100m;

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /assets/ {
        try_files $uri =404;
        expires 7d;
        add_header Cache-Control "public";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINXEOF

  docker rm -f listingfy-web >/dev/null 2>&1 || true
  docker run -d \
    --name listingfy-web \
    --restart unless-stopped \
    --network host \
    -v "$APP_DIR/web/dist:/usr/share/nginx/html:ro" \
    -v "$APP_DIR/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
    nginx:1.27-alpine

  sleep 2
  curl -fsSI http://127.0.0.1/ >/dev/null
  echo "WEB_OK"
else
  echo "Docker is unavailable; skipping web container."
fi

echo "DEPLOY_OK"
