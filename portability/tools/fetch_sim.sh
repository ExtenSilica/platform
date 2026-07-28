#!/usr/bin/env bash
# Fetch a portable Icarus Verilog (via YosysHQ oss-cad-suite) for local simulation.
# The suite is large and gitignored — run this once per machine.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/third_party/oss-cad-suite"
URL="${OSS_CAD_SUITE_URL:-https://github.com/YosysHQ/oss-cad-suite-build/releases/download/2024-09-17/oss-cad-suite-linux-x64-20240917.tgz}"

if [[ -x "$DEST/bin/iverilog" && -x "$DEST/bin/vvp" ]]; then
  echo "already present: $DEST"
  "$DEST/bin/iverilog" -V | head -1
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "downloading $URL ..."
curl -L --retry 3 -o "$TMP/oss.tgz" "$URL"
mkdir -p "$DEST"
echo "extracting (bin + lib + libexec) ..."
tar -xzf "$TMP/oss.tgz" -C "$DEST" --strip-components=1 \
  --wildcards '*/bin/iverilog' '*/bin/vvp' '*/bin/iverilog-*' '*/bin/vvp' \
  '*/bin/ghdl' '*/bin/ghdl*' \
  '*/libexec/iverilog' '*/libexec/ivl' '*/libexec/ivlpp' '*/libexec/vvp' \
  '*/libexec/ghdl*' \
  '*/lib/*' '*/lib/ghdl/**'
"$DEST/bin/iverilog" -V | head -1
"$DEST/bin/ghdl" --version | head -1
echo "ok: $DEST"
