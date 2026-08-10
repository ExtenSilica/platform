# Spec: XSIL governance points + `/token` page

**Version:** May 2026  
**Status:** Phase 1 implemented (off-chain ledger + address link). Aragon on-chain claim = Phase 2.

## 0. Principles

- **XSIL** currently has no established market price or liquidity.
- ExtenSilica does not sell XSIL or operate an ICO, presale, or investment offering.
- Represents **contribution history** and **future governance participation** on ExtenSilica.
- Users **earn points on-platform** (email/OAuth account). **Linking an EVM address** is optional and only used to **claim** points on-chain when Aragon is live.
- Login remains email/OAuth. Web3 is optional for claim only.

**Notice (required on `/token`, claim UI, dashboard, docs, grant emails, Aragon description, and API):**

> XSIL currently has no established market price or liquidity. ExtenSilica does not sell XSIL and is not conducting an ICO, presale, or investment offering. XSIL is distributed for verified contributions and currently provides governance participation. ExtenSilica does not promise listing, liquidity, redemption, appreciation, income, or financial return. XSIL may never develop a market or market value.

## 1. Boundary vs financial anti-drift policy

The 2026 implementation plan forbids **payment wallets, escrow, USDC, payouts**. This feature is **not** that:

| Allowed | Forbidden |
|---------|-----------|
| Off-chain point ledger | `Wallet` / `Payout` models, balances in USD |
| `linkedEvmAddress` for future DAO claim | `wallet` field name in schema/API (CI) |
| Aragon DAO governance (Phase 2) | Trading, pricing, ICO, rewards in money |

## 2. Phase 1 (shipped in platform repo)

### Data model

- `TokenBalance` — per-user `pendingXsil`, `claimedXsil`, `totalEarned`, optional `linkedEvmAddress`.
- `TokenGrant` — accrual rows with `TokenGrantReason`, `TokenGrantStatus` (`PENDING` → `APPROVED` → `CLAIMED`), idempotent on `(userId, reason, referenceId)`.

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

- `/token` — explainer, XSIL notice, balance (logged in), link address (MetaMask or paste), claim status

### Wallet link (RainbowKit + EIP-191)

- `GET /auth/me/wallet/message?address=0x…` — sign-in challenge (auth)
- `POST /auth/me/wallet` — `{ address, signature, message }` → `{ walletAddress, pendingXsil }` (auth)
- `DELETE /auth/me/wallet` — disconnect (auth)

Frontend: RainbowKit + wagmi (`base` + `mainnet` read). Env template: `store-frontend/.env.local.example` (`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_XSIL_CONTRACT_ADDRESS`, `NEXT_PUBLIC_API_URL`).

### Token documentation (section 7)

- `/token/documentation` — SSR whitepaper v1.0 (10 sections). Export via browser Print → Save as PDF (`print` CSS hides chrome).
- Copy: `store-frontend/lib/token-documentation-content.ts`.

### Smart contract (section 5)

- Source: `contracts/src/XSILToken.sol` (Foundry + OpenZeppelin v5).
- ERC-20, ERC20Permit, AccessControl, Pausable; `MAX_SUPPLY = 10M * 1e18`; founder 3M issued at deploy.
- Contributor payouts: `transferFrom` treasury → contributor via backend allowance (see `lib/blockchain.ts`); not per-grant `mint`.

### Grant flow (section 4)

- Hooks call `createTokenGrantSafe` — `PENDING` by default, `autoApprove: true` for automated actions.
- `GET /auth/me/token-balance`, `POST /auth/me/token-claim` (treasury transfer on Base when configured, or `XSIL_CLAIM_STUB=true` in dev).
- Admin: `GET /admin/token-grants`, `POST …/approve`, `POST …/reject`, `POST …/manual`.

## 3. Phase 2 — Aragon

Env (production) — see `store-backend/.env.example`:

- `ARAGON_DAO_PUBLIC_URL` — public DAO link on `/token` (`GET /governance` → `aragonUrl`). **Not** `NEXT_PUBLIC_ARAGON_DAO_URL`.
- `ARAGON_DAO_ADDRESS`
- `ARAGON_GOVERNANCE_TOKEN_ADDRESS`
- `ARAGON_CLAIM_CONTRACT_ADDRESS` (optional)
- `ARAGON_DAO_DESCRIPTION` (optional)

On-chain claim (treasury transfer) — same file:

- `XSIL_CONTRACT_ADDRESS`, `XSIL_TREASURY_ADDRESS`, `XSIL_BACKEND_ADDRESS`, `XSIL_BACKEND_PRIVATE_KEY`, `XSIL_RPC_URL`, `XSIL_CHAIN_ID`
- `XSIL_CLAIM_STUB=true` (dev only)
- Before each `transferFrom`, the API reads `allowance(treasury, backend)` on-chain; insufficient allowance returns 503 with a DAO proposal hint. XSIL-1 approved **500,000 XSIL** (from 2026-06-01).

Flow:

1. User links address on `/token`.
2. Backend verifies cumulative points ≥ threshold.
3. User signs claim message or submits tx to Aragon claim contract.
4. Backend records `claimTxHash` / `claimedAt`.

Until configured, `GET /me/governance-claim` returns `phase: "pending"`.

## 4. Copy / legal

- Link from `/governance` and footer Docs → **Governance points**
- FAQ entry (future): difference between API tokens (`/dashboard/tokens`) and XSIL governance points
