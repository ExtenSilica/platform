/**
 * XSIL Token Documentation v1.0 — canonical whitepaper copy (spec §7).
 * Shared with `/token` earn/supply tables via token-page-data where applicable.
 */

import { ARAGON_DAO_ADDRESS, ARAGON_DAO_PUBLIC_URL } from "@/lib/aragon-dao";
import {
  XSIL_BASESCAN_URL,
  XSIL_CHAIN_ID,
  XSIL_CONTRACT_ADDRESS,
} from "@/lib/xsil-contract";
import {
  GOVERNANCE_VOTING_PARAMS,
  TOKEN_DISTRIBUTION_INTRO,
  TOKEN_EARN_ROWS,
  TOKEN_SUPPLY_FOOTNOTE,
  TOKEN_SUPPLY_ROWS,
} from "@/lib/token-page-data";

export const TOKEN_DOC_VERSION = "1.0";
export const TOKEN_DOC_DATE = "August 2026";

export const TOKEN_OVERVIEW_ROWS = [
  { property: "Name", value: "ExtenSilica Governance Token" },
  { property: "Symbol", value: "XSIL" },
  { property: "Network", value: "Base (Ethereum L2)" },
  { property: "Chain ID", value: String(XSIL_CHAIN_ID) },
  { property: "Total supply", value: "10,000,000 XSIL" },
  { property: "Contract", value: XSIL_CONTRACT_ADDRESS },
  { property: "Standard", value: "ERC-20 (permit, pausable)" },
  { property: "Governance DAO", value: "ExtenSilica DAO on Aragon (Base)" },
  { property: "Market status", value: "No established price or liquidity" },
] as const;

export const TOKEN_DISTRIBUTION_NOTE = `${TOKEN_DISTRIBUTION_INTRO} ${TOKEN_SUPPLY_FOOTNOTE}`;

export const GOVERNANCE_SCOPE_ITEMS = [
  "Registry policies (provenance, publication, and curation)",
  "Featured package selection",
  "Future token distribution decisions",
  "Platform roadmap prioritization",
] as const;

export const CLAIM_STEPS = [
  "Submit eligible package or registry work for contribution review.",
  "Sign in at extensilica.com.",
  "Connect an Ethereum-compatible wallet (MetaMask, Coinbase Wallet, WalletConnect, etc.).",
  "Sign a free message to verify wallet ownership (no gas).",
  "Claim approved tokens — XSIL is transferred from the DAO treasury to your wallet on Base.",
  "Tokens appear in your connected wallet.",
] as const;

export const FUTURE_LIQUIDITY_COPY = `XSIL is worth $0 today. ExtenSilica does not sell XSIL. There is no ICO, presale, or paid allocation.

If ExtenSilica grows into widely used infrastructure, the role of XSIL may evolve through community governance. It may also never acquire any market value.

There are no promises. Build first.`;

export const XSIL_NOTICE_CONTEXT = `This notice describes ExtenSilica's current conduct and commitments. It does not determine the legal classification of XSIL in any jurisdiction.

ExtenSilica is an independent project and is not affiliated with RISC-V International.`;

export const TOKEN_DOC_CONTACT = {
  email: "contact@extensilica.com",
  site: "https://extensilica.com",
  github: "https://github.com/ExtenSilica",
} as const;

export { GOVERNANCE_VOTING_PARAMS, TOKEN_EARN_ROWS, TOKEN_SUPPLY_ROWS };
