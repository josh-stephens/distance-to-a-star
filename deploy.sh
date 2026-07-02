#!/usr/bin/env bash
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-all}"

case "$TARGET" in
  bill|skippy|all) ;;
  *) echo "Usage: $0 [bill|skippy|all]  (default: all)"; exit 1 ;;
esac

# Data integrity gate — refuse to ship broken references
if command -v node >/dev/null 2>&1; then
  node "$SRC/tests/validate-data.js" >/dev/null || {
    echo "ABORT: tests/validate-data.js failed — run it for details."; exit 1; }
fi

echo "Deploying Cosmic Distance Explorer (target: $TARGET)..."

# Auto-increment cache-buster in index.html so Cloudflare serves fresh JS
STAMP=$(date +%Y%m%d%H%M%S)
sed -i '' "s/\?v=[a-zA-Z0-9]*\"/\?v=${STAMP}\"/g" "$SRC/index.html"

deploy_host() {
  local host="$1" dest="$2"
  ssh "$host" "mkdir -p /tmp/cosmos-deploy/js /tmp/cosmos-deploy/img /tmp/cosmos-deploy/fonts"
  scp "$SRC/index.html" "$host:/tmp/cosmos-deploy/index.html"
  scp "$SRC/js/data.js" "$SRC/js/app.js" "$host:/tmp/cosmos-deploy/js/"
  scp "$SRC"/img/* "$host:/tmp/cosmos-deploy/img/" 2>/dev/null || true
  scp "$SRC"/fonts/* "$host:/tmp/cosmos-deploy/fonts/" 2>/dev/null || true
  ssh "$host" "sudo rsync -a --delete /tmp/cosmos-deploy/ '$dest' && rm -rf /tmp/cosmos-deploy"
  echo "  $host: done"
}

if [ "$TARGET" = "bill" ] || [ "$TARGET" = "all" ]; then
  deploy_host bill /opt/caddy/sites-content/distance-to-a-star/
fi
if [ "$TARGET" = "skippy" ] || [ "$TARGET" = "all" ]; then
  deploy_host skippy /var/www/cosmos/
fi

echo "Deployed ($TARGET) with cache-bust v=${STAMP}"
