#!/usr/bin/env bash
# PR-G8 — fail CI if the registry schema or migrations introduce financial tables/fields.
# Documentation and the explicit FORBIDDEN_MONEY_KEYS allowlist are excluded.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail() {
  echo "check-no-financial-drift: $*" >&2
  exit 1
}

SCHEMA="$ROOT/store-backend/prisma/schema.prisma"
MIGRATIONS="$ROOT/store-backend/prisma/migrations"

if [[ ! -f "$SCHEMA" ]]; then
  fail "missing $SCHEMA"
fi

# ── Prisma models we must never add ───────────────────────────────────────────
if grep -iE '^[[:space:]]*model[[:space:]]+(Wallet|Payout|Escrow|FundingContribution|FundingPayment|Sponsor)[[:space:]]*\{' "$SCHEMA"; then
  fail "forbidden financial model name in schema.prisma"
fi

# ── Prisma field names (fundingContactEmail / fundingNote are allowed) ────────
if grep -iE '^[[:space:]]+(wallet|escrow|payout|usdc|funded|paid|targetAmount|txhash|txHash)[[:space:]]+' "$SCHEMA"; then
  fail "forbidden financial field in schema.prisma"
fi

if grep -iE '^[[:space:]]+(amount|currency)[[:space:]]+' "$SCHEMA"; then
  fail "forbidden amount/currency field in schema.prisma"
fi

# ── SQL migrations ────────────────────────────────────────────────────────────
if [[ -d "$MIGRATIONS" ]]; then
  if grep -riE 'CREATE TABLE[[:space:]]+("?)(Wallet|Payout|Escrow|FundingContribution|FundingPayment|wallets|payouts)\1' "$MIGRATIONS" 2>/dev/null; then
    fail "forbidden financial table in prisma migration"
  fi
fi

# ── Source scan (identifiers only; allowlisted paths may mention terms in prose) ─
RG_BIN="$(command -v rg || true)"
if [[ -z "$RG_BIN" ]]; then
  echo "check-no-financial-drift: rg not found; skipping source scan"
  exit 0
fi

ALLOW_GLOBS=(
  '!docs/**'
  '!store-backend/src/lib/implementationRequest.ts'
  '!store-backend/test/**'
  '!store-frontend/app/legal/**'
  '!store-frontend/app/faq/**'
  '!store-frontend/components/request-implementation-card.tsx'
  '!store-frontend/app/token/**'
  '!store-frontend/components/token/**'
  '!store-backend/src/lib/governancePoints.ts'
  '!store-backend/src/controllers/governanceController.ts'
  '!store-backend/src/controllers/walletController.ts'
  '!store-backend/src/lib/walletVerification.ts'
  '!store-backend/src/lib/tokenGrants.ts'
  '!store-backend/src/lib/tokenClaim.ts'
  '!store-backend/src/lib/blockchain.ts'
  '!store-backend/src/lib/xsilAbi.ts'
  '!store-backend/src/controllers/tokenController.ts'
  '!store-backend/src/controllers/adminTokenGrantsController.ts'
  '!store-frontend/providers/**'
  '!store-frontend/components/token/connect-wallet-modal.tsx'
  '!docs/spec-xsil-governance-token.md'
  '!scripts/check-no-financial-drift.sh'
)

# Match JSON/API-style keys or Prisma-style field declarations in new code.
PATTERN='["'\'']?(wallet|escrow|payout|usdc|funded|paid|targetAmount)["'\'']?[[:space:]:]'
if "$RG_BIN" -n -i "$PATTERN" \
  "${ALLOW_GLOBS[@]}" \
  store-backend/src \
  store-frontend/lib \
  store-frontend/app \
  2>/dev/null; then
  fail "forbidden financial identifier in application source (see allowlist in script)"
fi

echo "check-no-financial-drift: OK"
