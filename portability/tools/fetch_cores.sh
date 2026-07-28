#!/usr/bin/env bash
# Optional reference checkouts used while developing backends (not required to run sims).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TP="$ROOT/third_party"
mkdir -p "$TP"

if [[ ! -d "$TP/picorv32/.git" ]]; then
  git clone --depth 1 https://github.com/YosysHQ/picorv32.git "$TP/picorv32"
else
  echo "picorv32 already present"
fi

if [[ ! -d "$TP/neorv32/.git" ]]; then
  git clone --depth 1 https://github.com/stnolting/neorv32.git "$TP/neorv32"
else
  echo "neorv32 already present"
fi
