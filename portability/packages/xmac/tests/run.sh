#!/bin/sh
# Golden-model + frozen evidence check for the xmac extension package.
set -eu
cd "$(dirname "$0")/.."
exec python3 tests/check_xmac.py
