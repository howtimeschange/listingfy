#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "===== Listingify Yunxiao build ====="
pwd
test -f package.json
test -f web/package.json

rm -rf .yunxiao-package package.tgz
mkdir -p .yunxiao-package/listingfy

tar \
  --exclude='./.git' \
  --exclude='./.yunxiao-package' \
  --exclude='./package.tgz' \
  --exclude='./node_modules' \
  --exclude='./web/node_modules' \
  --exclude='./tmp' \
  --exclude='./backups' \
  --exclude='./data/*.sqlite' \
  --exclude='./data/*.sqlite-*' \
  --exclude='./data/*.db' \
  --exclude='./data/*.db-*' \
  --exclude='./data/shein-metadata' \
  --exclude='./data/deepdraw-content' \
  --exclude='./.env' \
  --exclude='./.env.local' \
  -cf - . | tar -xf - -C .yunxiao-package/listingfy

tar zcf package.tgz -C .yunxiao-package listingfy

echo "===== Build artifact ====="
ls -lh package.tgz
tar tzf package.tgz | head -40
tar tzf package.tgz | grep -q '^listingfy/ci/yunxiao-deploy.sh$'
echo "package.tgz contains ci/yunxiao-deploy.sh"
