#!/usr/bin/env bash
# =============================================================================
# publish-rvx-demo.sh
#
# Publishes the bundled rvx-demo fixture (mirrors extensilica/xsil examples/rvx-demo) to production.
# Run this ONCE after all §12 production prerequisites are live.
#
# Prerequisites (must all be done first):
#   12.1  Production PostgreSQL is up and migrations have run
#   12.3  TLS/HTTPS is active on the API domain
#   12.4  api.extensilica.com is reachable
#   12.5  extensilica.com is reachable
#
# How to use:
#   1. Point the CLI at the production registry:
#        edit ~/.extensilica/config.json
#        set: { "registry": "https://api.extensilica.com", "token": "" }
#
#   2. Log in with your production account:
#        xsil login
#
#   3. Run this script from the repo root:
#        bash scripts/publish-rvx-demo.sh
#
#   4. Restore local dev config afterwards:
#        edit ~/.extensilica/config.json
#        set: { "registry": "http://localhost:3001", "token": "<dev-token>" }
# =============================================================================
set -euo pipefail

PROD_REGISTRY="https://api.extensilica.com"
PKG_DIR="$(cd "$(dirname "$0")/../store-backend/test/fixtures/rvx-demo" && pwd)"
CHANGELOG="Initial public release of the rvx-demo reference package — a minimal RV64GC Fibonacci demo that works with Spike, QEMU, or in demo mode with no simulator installed."

# ── Confirm target ────────────────────────────────────────────────────────────
echo ""
echo "  Package : $(jq -r '.name + "@" + .version' "$PKG_DIR/manifest.json")"
echo "  Registry: $PROD_REGISTRY"
echo ""
read -r -p "Publish to PRODUCTION? This cannot be undone. [y/N] " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
echo ""

# ── Verify the CLI is pointed at production ────────────────────────────────
CFG="$HOME/.extensilica/config.json"
if [[ -f "$CFG" ]]; then
  CURRENT_REG=$(jq -r '.registry // ""' "$CFG" 2>/dev/null || true)
  if [[ "$CURRENT_REG" != "$PROD_REGISTRY" ]]; then
    echo "ERROR: CLI config points to '$CURRENT_REG', not '$PROD_REGISTRY'."
    echo "       Update ~/.extensilica/config.json and log in first."
    exit 1
  fi
else
  echo "ERROR: No CLI config found at $CFG. Run 'xsil login' first."
  exit 1
fi

# ── Dry-run ──────────────────────────────────────────────────────────────────
echo "Step 1/2 — dry-run …"
xsil publish "$PKG_DIR" --changelog "$CHANGELOG" --dry-run
echo ""
echo "Dry-run passed."
echo ""

# ── Live publish ─────────────────────────────────────────────────────────────
echo "Step 2/2 — publishing …"
xsil publish "$PKG_DIR" --changelog "$CHANGELOG"
echo ""
echo "✓ rvx-demo published!"
echo "  View at: https://extensilica.com/package/rvx-demo"
echo ""
