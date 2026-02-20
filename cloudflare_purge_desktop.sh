#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_ZONE_ID:?missing CLOUDFLARE_ZONE_ID}"
: "${CLOUDFLARE_API_TOKEN:?missing CLOUDFLARE_API_TOKEN}"

BASE_URL="${RELEASE_BASE_URL:-https://updater.grayjay.app/Apps}"
BASE_URL="${BASE_URL%/}" # avoid double slashes

appName="${1:?usage: cloudflare_purge_desktop.sh <appName> <version>}"
version="${2:?}"

echo "Letting things settle for 10s for ${appName} (version ${version})..."

sleep 10

echo "Purging Cloudflare cache for ${appName} (version ${version})..."

curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{
    \"files\": [
      \"${BASE_URL}/${appName}/Versions.json\",
      \"${BASE_URL}/${appName}/VersionLast.json\",

      \"${BASE_URL}/${appName}/Grayjay.Desktop-win-x64.zip\",
      \"${BASE_URL}/${appName}/Grayjay.Desktop-linux-x64.zip\",

      \"${BASE_URL}/${appName}/${version}/Grayjay.Desktop-win-x64-v${version}.zip\",
      \"${BASE_URL}/${appName}/${version}/Grayjay.Desktop-linux-x64-v${version}.zip\"
    ]
  }"

sleep 10