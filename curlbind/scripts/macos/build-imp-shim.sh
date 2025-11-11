#!/usr/bin/env bash
set -euo pipefail

VERSION="1.2.2"
URL="https://github.com/lexiforest/curl-impersonate/releases/download/v${VERSION}/libcurl-impersonate-v${VERSION}.arm64-macos.tar.gz"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
NATIVE_DIR="${ROOT_DIR}/native"
OUT_DIR="${ROOT_DIR}/out/macos-arm64"

[[ "$(uname -s)" == "Darwin" ]] || { echo "macOS only." >&2; exit 1; }
[[ "$(uname -m)" == "arm64"  ]] || { echo "arm64 only." >&2; exit 1; }

mkdir -p "${OUT_DIR}"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "${WORK_DIR}"' EXIT

TARBALL="${WORK_DIR}/libcurl-impersonate-${VERSION}.tar.gz"
curl -fsSL --retry 3 -o "${TARBALL}" "${URL}"
tar -xzf "${TARBALL}" -C "${WORK_DIR}"

src="$(find "${WORK_DIR}" -maxdepth 3 -name 'libcurl-impersonate*.dylib' | head -n1 || true)"
[[ -n "${src}" ]] || { echo "libcurl-impersonate dylib not found in archive"; exit 1; }

cp -f "${src}" "${OUT_DIR}/libcurl-impersonate.dylib"

install_name_tool -id "@rpath/libcurl-impersonate.dylib" "${OUT_DIR}/libcurl-impersonate.dylib" || true

clang -dynamiclib -fPIC \
  -DLIBCURL_IMPERSONATE \
  -I "${WORK_DIR}" -I "${WORK_DIR}/include" \
  "${NATIVE_DIR}/curlshim.c" \
  -o "${OUT_DIR}/libcurlshim.dylib" \
  -L "${OUT_DIR}" -lcurl-impersonate \
  -Wl,-rpath,@loader_path -Wl,-rpath,@loader_path/.

old_dep="$(otool -L "${OUT_DIR}/libcurlshim.dylib" | awk '/libcurl-impersonate.*\.dylib/ {print $1; exit}')"
install_name_tool -change "${old_dep}" "@loader_path/libcurl-impersonate.dylib" "${OUT_DIR}/libcurlshim.dylib"

strip -x "${OUT_DIR}/libcurlshim.dylib" || true

echo "== Outputs =="
ls -lh "${OUT_DIR}/libcurlshim.dylib" "${OUT_DIR}/libcurl-impersonate.dylib"
echo "== Shim deps =="
otool -L "${OUT_DIR}/libcurlshim.dylib"
