#!/usr/bin/env bash
set -euo pipefail
umask 077

SRC_DIR="${1:?missing source dir}"
APP_DIR="${APP_DIR:-/opt/listingfy}"
DATABASE_URL_VALUE="${PROD_DATABASE_URL:-${DATABASE_URL:-}}"
ALLOWED_ORIGINS="${LISTINGIFY_ALLOWED_ORIGINS:-https://listingify.semirapp.com,https://smbd.semirapp.cn,http://10.90.20.221,http://127.0.0.1:3001,http://localhost:3001}"
PUBLIC_ORIGIN="${LISTINGIFY_PUBLIC_ORIGIN:-https://listingify.semirapp.com}"
TRUSTED_PROXY="${LISTINGIFY_TRUSTED_PROXY:-true}"
RUN_SEED_IMPORT_VALUE="${RUN_SEED_IMPORT:-0}"
DEEPDRAW_M2_DIR="${DEEPDRAW_M2_DIR:-$APP_DIR/.m2}"
DEEPDRAW_MAVEN_MIRROR_URL_VALUE="${DEEPDRAW_MAVEN_MIRROR_URL:-https://maven.aliyun.com/repository/public}"
DEPLOY_RUN_ID="${CI_COMMIT_SHA:-manual-$(date +%Y%m%d%H%M%S)}"
DEPLOY_RUN_ID="$(printf '%s' "$DEPLOY_RUN_ID" | tr -c 'A-Za-z0-9._-' '-')"
RELEASE_WORK_ROOT="${LISTINGIFY_RELEASE_WORK_ROOT:-/opt/listingfy-release/prepared}"
PREPARED_DIR="${LISTINGIFY_PREPARED_DIR:-$RELEASE_WORK_ROOT/$DEPLOY_RUN_ID}"
NPM_CACHE_DIR="${LISTINGIFY_NPM_CACHE_DIR:-$APP_DIR/.npm-cache}"

if [ -z "$DATABASE_URL_VALUE" ]; then
  echo "ERROR: PROD_DATABASE_URL is required. Configure it as a Yunxiao secret variable."
  exit 10
fi

if [ -z "${LISTINGIFY_CREDENTIAL_SECRET:-}" ]; then
  echo "ERROR: LISTINGIFY_CREDENTIAL_SECRET is required. Configure it as a Yunxiao secret variable."
  exit 11
fi

if [ -z "$PREPARED_DIR" ] || [ "$PREPARED_DIR" = "/" ]; then
  echo "ERROR: unsafe prepared release directory: $PREPARED_DIR"
  exit 12
fi

case "$PREPARED_DIR/" in
  "$APP_DIR"/*)
    echo "ERROR: LISTINGIFY_PREPARED_DIR must not be inside APP_DIR."
    exit 13
    ;;
esac

echo "===== Listingify Yunxiao deploy ====="
echo "SRC_DIR=$SRC_DIR"
echo "APP_DIR=$APP_DIR"
echo "PREPARED_DIR=$PREPARED_DIR"
test -f "$SRC_DIR/package.json"
test -d "$SRC_DIR/web"

mkdir -p "$APP_DIR" "$RELEASE_WORK_ROOT" "$NPM_CACHE_DIR" "$DEEPDRAW_M2_DIR"
rm -rf "$PREPARED_DIR"
mkdir -p "$PREPARED_DIR"

echo "===== Prepare release workspace ====="
rsync -a --delete "$SRC_DIR"/ "$PREPARED_DIR"/ \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='data/*.sqlite' \
  --exclude='data/*.sqlite-*' \
  --exclude='data/*.db' \
  --exclude='data/*.db-*' \
  --exclude='data/listing-assets' \
  --exclude='data/product-archive-draft-images' \
  --exclude='/tmp' \
  --exclude='node_modules' \
  --exclude='web/node_modules'

cd "$PREPARED_DIR"
mkdir -p "$APP_DIR/data/listing-assets" "$APP_DIR/data/product-archive-draft-images" "$APP_DIR/tmp" "$PREPARED_DIR/data"

echo "===== Write production env ====="
write_optional_env() {
  local name="$1"
  local value="${!name:-}"
  if [ -n "$value" ]; then
    printf '%s=%s\n' "$name" "$value"
  fi
}
{
  printf 'DATABASE_PROVIDER=postgres\n'
  printf 'DATABASE_URL=%s\n' "$DATABASE_URL_VALUE"
  printf 'DATABASE_POOL_MAX=%s\n' "${DATABASE_POOL_MAX:-10}"
  printf 'DATABASE_CONNECT_TIMEOUT_MS=%s\n' "${DATABASE_CONNECT_TIMEOUT_MS:-3000}"
  printf 'DATABASE_IDLE_TIMEOUT_MS=%s\n' "${DATABASE_IDLE_TIMEOUT_MS:-30000}"
  printf 'LISTINGIFY_ALLOWED_ORIGINS=%s\n' "$ALLOWED_ORIGINS"
  printf 'LISTINGIFY_PUBLIC_ORIGIN=%s\n' "$PUBLIC_ORIGIN"
  printf 'LISTINGIFY_TRUSTED_PROXY=%s\n' "$TRUSTED_PROXY"
  printf 'NODE_ENV=production\n'
  printf 'PORT=%s\n' "${PORT:-3001}"
  [ -n "${LISTINGIFY_ADMIN_USERNAME:-}" ] && printf 'LISTINGIFY_ADMIN_USERNAME=%s\n' "$LISTINGIFY_ADMIN_USERNAME"
  [ -n "${LISTINGIFY_ADMIN_PASSWORD:-}" ] && printf 'LISTINGIFY_ADMIN_PASSWORD=%s\n' "$LISTINGIFY_ADMIN_PASSWORD"
  [ -n "${LISTINGIFY_ADMIN_DISPLAY_NAME:-}" ] && printf 'LISTINGIFY_ADMIN_DISPLAY_NAME=%s\n' "$LISTINGIFY_ADMIN_DISPLAY_NAME"
  printf 'LISTINGIFY_CREDENTIAL_SECRET=%s\n' "$LISTINGIFY_CREDENTIAL_SECRET"
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
  printf 'DEEPDRAW_M2_REPOSITORY=%s\n' "${DEEPDRAW_M2_REPOSITORY:-$DEEPDRAW_M2_DIR/repository}"
  printf 'DEEPDRAW_MAVEN_MIRROR_URL=%s\n' "$DEEPDRAW_MAVEN_MIRROR_URL_VALUE"
  for name in \
    AI_BASE_URL \
    AI_MODEL \
    AI_API_KEY \
    AI_TIMEOUT_MS \
    AI_ROUTING_ENABLED \
    AI_ROUTING_CACHE_TTL_MS \
    AI_ROUTING_CIRCUIT_FAILURE_THRESHOLD \
    AI_ROUTING_CIRCUIT_COOLDOWN_MS \
    AI_ROUTING_MISCONFIGURED_COOLDOWN_MS \
    AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_BASE_URL \
    AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_GEMINI_MODEL \
    AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_API_KEY \
    AI_PROVIDER_SEMIR_OVERSEAS_ANTHROPIC_BASE_URL \
    AI_PROVIDER_SEMIR_OVERSEAS_ANTHROPIC_API_KEY \
    AI_PROVIDER_SEMIR_DOMESTIC_OPENAI_BASE_URL \
    AI_PROVIDER_SEMIR_DOMESTIC_OPENAI_API_KEY \
    AI_PROVIDER_1XM_BASE_URL \
    AI_PROVIDER_1XM_GEMINI_MODEL \
    AI_PROVIDER_1XM_API_KEY \
    AI_GEMINI_INLINE_REMOTE_IMAGES \
    AI_GEMINI_INLINE_IMAGE_MAX_BYTES \
    AI_GEMINI_INLINE_IMAGE_LIMIT \
    AI_SCENARIO_TITLE_TRANSLATION_MODE \
    AI_SCENARIO_SIZE_MAPPING_MODE \
    AI_SCENARIO_SHEIN_ATTRIBUTE_MODE \
    AI_SCENARIO_SHEIN_DESCRIPTION_MODE \
    AI_SCENARIO_DEEPDRAW_FIELD_FILL_MODE \
    AI_SCENARIO_SHEIN_CATEGORY_MODE \
    AI_SCENARIO_NEUTRAL_SKC_MODE \
    AI_SCENARIO_DEEPDRAW_TRADE_MODE \
    AI_1XM_DAILY_REQUEST_BUDGET \
    AI_1XM_DAILY_TOKEN_BUDGET
  do
    write_optional_env "$name"
  done
} > .env.local
chmod 600 .env.local

export npm_config_fetch_retries="${NPM_FETCH_RETRIES:-5}"
export npm_config_fetch_retry_factor="${NPM_FETCH_RETRY_FACTOR:-2}"
export npm_config_fetch_retry_mintimeout="${NPM_FETCH_RETRY_MINTIMEOUT:-10000}"
export npm_config_fetch_retry_maxtimeout="${NPM_FETCH_RETRY_MAXTIMEOUT:-120000}"
export npm_config_cache="$NPM_CACHE_DIR"
if [ -n "${NPM_REGISTRY_URL:-}" ]; then
  export npm_config_registry="$NPM_REGISTRY_URL"
fi

echo "===== Check runtime ====="
HOST_NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
  node -v
  npm -v
  HOST_NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
fi

if [ "$HOST_NODE_MAJOR" -ge 24 ]; then
  export DEEPDRAW_M2_REPOSITORY="${DEEPDRAW_M2_REPOSITORY:-$DEEPDRAW_M2_DIR/repository}"
  export DEEPDRAW_MAVEN_MIRROR_URL="$DEEPDRAW_MAVEN_MIRROR_URL_VALUE"
  echo "===== Prepare DeepDraw SDK runtime on host ====="
  node scripts/deepdraw_sdk_prepare.mjs "$PREPARED_DIR"

  echo "===== Install dependencies on host ====="
  npm --prefix web ci --include=dev --prefer-offline

  echo "===== Build web on host ====="
  npm --prefix web run build

  echo "===== Migrate database on host ====="
  npm run db:migrate
  if [ "$RUN_SEED_IMPORT_VALUE" = "1" ]; then
    echo "===== Import seed data on host ====="
    npm run seed:import
  else
    echo "===== Skip seed import; set RUN_SEED_IMPORT=1 to enable ====="
  fi
else
  echo "Host Node >=24 is unavailable; deploying with Docker Node runtime."
  if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: Docker is required on CentOS 7 because Node 24 requires glibc >= 2.28 on host."
    echo "Install Docker, then rerun this pipeline."
    exit 21
  fi

  NODE_IMAGE="${LISTINGIFY_NODE_IMAGE:-node:24-bookworm}"
  MAVEN_IMAGE="${LISTINGIFY_MAVEN_IMAGE:-maven:3.9-eclipse-temurin-17}"
  RUNTIME_IMAGE="${LISTINGIFY_RUNTIME_IMAGE:-listingfy-node-java:24-bookworm}"
  DOCKER_NPM_ENV=(
    -e "npm_config_fetch_retries=$npm_config_fetch_retries"
    -e "npm_config_fetch_retry_factor=$npm_config_fetch_retry_factor"
    -e "npm_config_fetch_retry_mintimeout=$npm_config_fetch_retry_mintimeout"
    -e "npm_config_fetch_retry_maxtimeout=$npm_config_fetch_retry_maxtimeout"
    -e "npm_config_cache=/root/.npm"
  )
  if [ -n "${npm_config_registry:-}" ]; then
    DOCKER_NPM_ENV+=(-e "npm_config_registry=$npm_config_registry")
  fi

  echo "Using Docker base image: $NODE_IMAGE"
  echo "Using Java/Maven toolchain image: $MAVEN_IMAGE"
  if [ "${LISTINGIFY_FORCE_RUNTIME_IMAGE_REBUILD:-0}" != "1" ] \
    && docker image inspect "$RUNTIME_IMAGE" >/dev/null 2>&1 \
    && docker run --rm "$RUNTIME_IMAGE" bash -c 'node -v; java -version >/dev/null; javac -version >/dev/null; mvn -version >/dev/null' >/dev/null 2>&1
  then
    echo "Reusing existing Docker runtime image: $RUNTIME_IMAGE"
  else
    echo "Preparing Docker runtime image: $RUNTIME_IMAGE"
    docker build \
      --build-arg NODE_IMAGE="$NODE_IMAGE" \
      --build-arg MAVEN_IMAGE="$MAVEN_IMAGE" \
      -t "$RUNTIME_IMAGE" \
      -f - "$PREPARED_DIR" <<'DOCKERFILE'
ARG NODE_IMAGE=node:24-bookworm
ARG MAVEN_IMAGE=maven:3.9-eclipse-temurin-17
FROM ${MAVEN_IMAGE} AS java_toolchain
FROM ${NODE_IMAGE}
COPY --from=java_toolchain /opt/java/openjdk /opt/java/openjdk
COPY --from=java_toolchain /usr/share/maven /usr/share/maven
ENV JAVA_HOME=/opt/java/openjdk
ENV MAVEN_HOME=/usr/share/maven
ENV PATH="/opt/java/openjdk/bin:/usr/share/maven/bin:${PATH}"
RUN java -version && javac -version && mvn -version
DOCKERFILE
  fi

  docker run --rm --network host \
    -v "$PREPARED_DIR:/app" \
    -v "$DEEPDRAW_M2_DIR:/app/.m2" \
    -v "$NPM_CACHE_DIR:/root/.npm" \
    -w /app \
    --env-file "$PREPARED_DIR/.env.local" \
    -e DEEPDRAW_M2_REPOSITORY=/app/.m2/repository \
    -e RUN_SEED_IMPORT="$RUN_SEED_IMPORT_VALUE" \
    "${DOCKER_NPM_ENV[@]}" \
    "$RUNTIME_IMAGE" \
    bash -c 'set -e; node -v; npm -v; java -version; javac -version; npm --prefix web ci --include=dev --prefer-offline; node scripts/deepdraw_sdk_prepare.mjs /app; npm --prefix web run build; npm run db:migrate; if [ "${RUN_SEED_IMPORT:-0}" = "1" ]; then echo "===== Import seed data in Docker ====="; npm run seed:import; else echo "===== Skip seed import; set RUN_SEED_IMPORT=1 to enable ====="; fi'
fi

echo "===== Write web server config ====="
cat > "$PREPARED_DIR/nginx.conf" <<'NGINXEOF'
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    client_max_body_size 600m;
    client_body_timeout 600s;

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Scheme $scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
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

server {
    listen 80;
    server_name shopify-inventory-sync.semirapp.com;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Scheme $scheme;
    }
}
NGINXEOF

echo "===== Verify prepared release ====="
test -x "$PREPARED_DIR/web/node_modules/.bin/tsx"
test -f "$PREPARED_DIR/web/dist/index.html"
test -f "$PREPARED_DIR/nginx.conf"

echo "===== Publish prepared release ====="
rsync -a --delete "$PREPARED_DIR"/ "$APP_DIR"/ \
  --exclude='data/*.sqlite' \
  --exclude='data/*.sqlite-*' \
  --exclude='data/*.db' \
  --exclude='data/*.db-*' \
  --exclude='data/listing-assets' \
  --exclude='data/product-archive-draft-images' \
  --exclude='/tmp' \
  --exclude='.m2' \
  --exclude='.npm-cache' \
  --exclude='/node_modules'
mkdir -p "$APP_DIR/data/listing-assets" "$APP_DIR/data/product-archive-draft-images" "$APP_DIR/tmp"

cd "$APP_DIR"

echo "===== Restart API ====="
if [ "$HOST_NODE_MAJOR" -ge 24 ]; then
  if ! command -v pm2 >/dev/null 2>&1; then
    npm install -g pm2
  fi

  pm2 delete listingfy-api || true
  pm2 start ./web/node_modules/.bin/tsx --name listingfy-api -- web/server/index.ts
  pm2 save
else
  docker rm -f listingfy-api >/dev/null 2>&1 || true
  docker run -d \
    --name listingfy-api \
    --restart unless-stopped \
    --network host \
    -v "$APP_DIR:/app" \
    -v "$DEEPDRAW_M2_DIR:/app/.m2" \
    -w /app \
    --env-file "$APP_DIR/.env.local" \
    -e DEEPDRAW_M2_REPOSITORY=/app/.m2/repository \
    "$RUNTIME_IMAGE" \
    bash -c 'java -version >/dev/null && ./web/node_modules/.bin/tsx web/server/index.ts'
fi

echo "===== Health check ====="
HEALTH_URL="http://127.0.0.1:${PORT:-3001}/api/health"
for attempt in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL"; then
    echo
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    echo "ERROR: API health check failed after ${attempt} attempts: $HEALTH_URL"
    exit 31
  fi
  sleep 2
done
echo

echo "===== Restart web container ====="
if command -v docker >/dev/null 2>&1; then
  test -f "$APP_DIR/web/dist/index.html"
  test -f "$APP_DIR/nginx.conf"

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
