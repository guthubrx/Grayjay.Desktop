#!/usr/bin/env bash
set -euo pipefail

mode="${1:?usage: remote_maintenance.sh on|off <server> <appName>}"
server="${2:?}"
appName="${3:?}"

targetDir="/var/www/html/Apps"

SSH_KEY_PRIV_FILE="/tmp/deploy_key"
echo "$SSH_KEY_PRIV" | base64 -d > "$SSH_KEY_PRIV_FILE"
chmod 600 "$SSH_KEY_PRIV_FILE"
SSH_CMD="ssh -i $SSH_KEY_PRIV_FILE -o StrictHostKeyChecking=no"

case "$mode" in
  on)
    $SSH_CMD "$server" "mkdir -p '$targetDir/$appName' && touch '$targetDir/$appName/maintenance'"
    ;;
  off)
    $SSH_CMD "$server" "rm -f '$targetDir/$appName/maintenance'"
    ;;
  *)
    echo "Unknown mode: $mode (expected on/off)" >&2
    exit 2
    ;;
esac
