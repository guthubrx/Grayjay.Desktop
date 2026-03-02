#!/usr/bin/env bash
set -euo pipefail

publish_dir="${1:?usage: generate_changelogs.sh <publish_dir>}"

if git rev-parse --is-shallow-repository >/dev/null 2>&1; then
  if [[ "$(git rev-parse --is-shallow-repository)" == "true" ]]; then
    git fetch --unshallow --tags --force --prune >/dev/null 2>&1 || true
  else
    git fetch --tags --force --prune >/dev/null 2>&1 || true
  fi
else
  if [[ -f .git/shallow ]]; then
    git fetch --unshallow --tags --force --prune >/dev/null 2>&1 || true
  else
    git fetch --tags --force --prune >/dev/null 2>&1 || true
  fi
fi

mkdir -p "${publish_dir}/Changelogs"
mapfile -t tags < <(git tag --list | grep -E '^[0-9]+$' | sort -n)

for tag in "${tags[@]}"; do
  desc="$(git for-each-ref "refs/tags/${tag}" --format='%(contents)')"
  out="${publish_dir}/Changelogs/${tag}.txt"

  if [[ -n "$desc" ]]; then
    printf '%s' "$desc" > "$out"
  else
    : > "$out"
  fi
done