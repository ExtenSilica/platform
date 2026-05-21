# Spec: XSIL governance points + `/token` page

**Version:** May 2026  
**Status:** Phase 1 implemented (off-chain ledger + address link). Aragon on-chain claim = Phase 2.

## 0. Principles

- **XSIL** (governance points) have **no monetary value today and may never have**.
- Not a security, utility token for payments, or payment rail.
- Represents **contribution history** and **future governance participation** on ExtenSilica.
- Users **earn points on-platform** (email/OAuth account). **Linking an EVM address** is optional and only used to **claim** points on-chain when Aragon is live.
- Login remains email/OAuth. Web3 is optional for claim only.

**Disclaimer (required on `/token`, claim UI, and API):**

> XSIL governance points have no monetary value today and may never have. They do not represent equity, revenue share, or a right to payment.

## 1. Boundary vs financial anti-drift policy

The 2026 implementation plan forbids **payment wallets, escrow, USDC, payouts**. This feature is **not** that:

| Allowed | Forbidden |
|---------|-----------|
| Off-chain point ledger | `Wallet` / `Payout` models, balances in USD |
| `linkedEvmAddress` for future DAO claim | `wallet` field name in schema/API (CI) |
| Aragon DAO governance (Phase 2) | Trading, pricing, ICO, rewards in money |

## 2. Phase 1 (shipped in platform repo)

### Data model

- `GovernancePointLedger` — immutable accrual rows (`reason`, `points`, `referenceKey`, unique per user).
- `GovernanceAddressLink` — one optional EVM address per user for claim.

### Accrual rules (config in code)

| Reason | Points | Reference key |
|--------|--------|---------------|
| `email_verified` | 25 | `email_verified` |
| `package_registered` | 40 | `package:{slug}` |
| `version_published` | 15 | `version:{slug}@{ver}` |
| `ownership_approved` | 50 | `ownership:{requestId}` |
| `implementation_verified` | 35 | `submission:{id}` |

### API

- `GET /governance` — public rules + disclaimer + Aragon env status
- `GET /governance/me` — balance + recent ledger (auth)
- `PATCH /me/governance-address` — link `linkedEvmAddress` (auth)
- `GET /me/governance-claim` — claim status / Aragon stub (auth)

### Web

- `/token` — explainer, disclaimer, balance (logged in), link address (MetaMask or paste), claim status

## 3. Phase 2 — Aragon

Env (production):

- `ARAGON_DAO_ADDRESS`
- `ARAGON_GOVERNANCE_TOKEN_ADDRESS`
- `ARAGON_CLAIM_CONTRACT_ADDRESS` (optional)

Flow:

1. User links address on `/token`.
2. Backend verifies cumulative points ≥ threshold.
3. User signs claim message or submits tx to Aragon claim contract.
4. Backend records `claimTxHash` / `claimedAt`.

Until configured, `GET /me/governance-claim` returns `phase: "pending"`.

## 4. Copy / legal

- Link from `/governance` and footer Docs → **Governance points**
- FAQ entry (future): difference between API tokens (`/dashboard/tokens`) and XSIL governance points
