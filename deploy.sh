#!/usr/bin/env bash
set -euo pipefail

FILE="cosmic-distances.html"
SRC="$(cd "$(dirname "$0")" && pwd)/$FILE"

if [ ! -f "$SRC" ]; then
  echo "Error: $FILE not found" >&2
  exit 1
fi

echo "Deploying $FILE..."

# bill (cosmos.eusd.org)
scp "$SRC" bill:/tmp/cosmos.html
ssh bill "sudo cp /tmp/cosmos.html /opt/caddy/sites-content/distance-to-a-star/index.html"
echo "  bill: done"

# skippy (cosmos.711bf.org)
scp "$SRC" skippy:/tmp/cosmos.html
ssh skippy "sudo cp /tmp/cosmos.html /var/www/cosmos/index.html"
echo "  skippy: done"

echo "Deployed to cosmos.eusd.org and cosmos.711bf.org"
