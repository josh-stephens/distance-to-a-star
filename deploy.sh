#!/usr/bin/env bash
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
echo "Deploying Cosmic Distance Explorer..."

# Auto-increment cache-buster in index.html so Cloudflare serves fresh JS
STAMP=$(date +%Y%m%d%H%M%S)
sed -i '' "s/\?v=[a-zA-Z0-9]*\"/\?v=${STAMP}\"/g" "$SRC/index.html"

# bill (cosmos.eusd.org)
ssh bill "mkdir -p /tmp/cosmos-deploy/js /tmp/cosmos-deploy/img"
scp "$SRC/index.html" bill:/tmp/cosmos-deploy/index.html
scp "$SRC/js/data.js" "$SRC/js/app.js" bill:/tmp/cosmos-deploy/js/
scp "$SRC"/img/*.jpg bill:/tmp/cosmos-deploy/img/ 2>/dev/null || true
ssh bill "sudo rsync -a --delete /tmp/cosmos-deploy/ /opt/caddy/sites-content/distance-to-a-star/ && rm -rf /tmp/cosmos-deploy"
echo "  bill: done"

# skippy (cosmos.711bf.org)
ssh skippy "mkdir -p /tmp/cosmos-deploy/js /tmp/cosmos-deploy/img"
scp "$SRC/index.html" skippy:/tmp/cosmos-deploy/index.html
scp "$SRC/js/data.js" "$SRC/js/app.js" skippy:/tmp/cosmos-deploy/js/
scp "$SRC"/img/*.jpg skippy:/tmp/cosmos-deploy/img/ 2>/dev/null || true
ssh skippy "sudo rsync -a --delete /tmp/cosmos-deploy/ /var/www/cosmos/ && rm -rf /tmp/cosmos-deploy"
echo "  skippy: done"

echo "Deployed to cosmos.eusd.org and cosmos.711bf.org (cache-bust: v=${STAMP})"
