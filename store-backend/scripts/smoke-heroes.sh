#!/usr/bin/env bash
# smoke-heroes.sh — verify hero registry packages before demos / LinkedIn posts.
#
# See docs/hero-packages.md for the curated slug list and rationale.
#
# Usage (from repo root):
#   bash store-backend/scripts/smoke-heroes.sh
#
# Requires: curl, jq, xsil on PATH
set -euo pipefail

REGISTRY_URL="${REGISTRY_URL:-https://api.extensilica.com}"
REGISTRY_URL="${REGISTRY_URL%/}"
export XSIL_REGISTRY="$REGISTRY_URL"

PRIMARY_HERO="rvx-demo"
# Tier 2 — must exist and run on production (see docs/hero-packages.md)
HERO_CATALOG_SLUGS=(
  riscv-zbkb
  riscv-zvbb
  riscv-zknh
)

REQUIRE_PRIMARY="${REQUIRE_PRIMARY:-}"

log() { printf '  %s\n' "$*"; }
ok()  { printf '✔ %s\n' "$*"; }
fail(){ printf '✘ %s\n' "$*" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v jq   >/dev/null 2>&1 || fail "jq is required"
command -v xsil >/dev/null 2>&1 || fail "xsil is required (cargo install xsil)"

echo ""
echo "Hero smoke — registry: $REGISTRY_URL"
echo ""

smoke_slug() {
  local slug="$1"
  local tier="$2"
  echo "── $slug ($tier) ──"

  local resp http_code body latest
  resp="$(curl -sS -w $'\nHTTP_CODE:%{http_code}' "$REGISTRY_URL/packages/$slug")"
  http_code="${resp##*HTTP_CODE:}"
  body="${resp%$'\n'HTTP_CODE:*}"

  if [[ "$http_code" != "200" ]]; then
    fail "$slug: GET /packages/$slug returned HTTP $http_code"
  fi
  if echo "$body" | jq -e '.error' >/dev/null 2>&1; then
    fail "$slug: $(echo "$body" | jq -r '.error')"
  fi
  latest="$(echo "$body" | jq -r '.latestVersion // empty')"
  [[ -n "$latest" ]] || fail "$slug: no latestVersion in API response"
  log "API ok — latest $latest"
  ok "$slug API"

  log "xsil info …"
  xsil info "$slug" >/dev/null
  ok "$slug info"

  log "xsil run …"
  xsil run "$slug"
  ok "$slug run"
  echo ""
}

primary_code="$(curl -sS -o /dev/null -w '%{http_code}' "$REGISTRY_URL/packages/$PRIMARY_HERO")"
if [[ "$primary_code" == "200" ]]; then
  smoke_slug "$PRIMARY_HERO" "primary"
elif [[ "$REQUIRE_PRIMARY" == "1" ]]; then
  fail "$PRIMARY_HERO is not on the registry (HTTP $primary_code). Publish with scripts/publish-rvx-demo.sh"
else
  echo "── $PRIMARY_HERO (primary) — skipped (not published; set REQUIRE_PRIMARY=1 to enforce)"
  echo ""
fi

for slug in "${HERO_CATALOG_SLUGS[@]}"; do
  smoke_slug "$slug" "catalog"
done

echo "All hero smoke checks passed."
