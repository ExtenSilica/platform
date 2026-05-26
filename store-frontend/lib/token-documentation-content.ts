/**
 * XSIL Token Documentation v1.0 — canonical whitepaper copy (spec §7).
 * Shared with `/token` earn/supply tables via token-page-data where applicable.
 */

import { ARAGON_DAO_ADDRESS, ARAGON_DAO_PUBLIC_URL } from "@/lib/aragon-dao";
import { getXsilBasescanUrl, getXsilContractAddress, XSIL_CHAIN_ID } from "@/lib/xsil-contract";
import {
  TOKEN_EARN_ROWS,
  TOKEN_SUPPLY_FOOTNOTE,
  TOKEN_SUPPLY_ROWS,
} from "@/lib/token-page-data";
import { XSIL_LEGAL_DISCLAIMER_LINES } from "@/lib/xsil-disclaimer";

export const TOKEN_DOC_VERSION = "1.0";
export const TOKEN_DOC_DATE = "May 2026";

const xsilContract = getXsilContractAddress();
const xsilBasescan = getXsilBasescanUrl(xsilContract);

export const TOKEN_OVERVIEW_ROWS = [
  { property: "Name", value: "ExtenSilica Governance Token" },
  { property: "Symbol", value: "XSIL" },
  { property: "Network", value: "Base (Ethereum L2)" },
  { property: "Chain ID", value: String(XSIL_CHAIN_ID) },
  { property: "Total supply", value: "10,000,000 XSIL" },
  { property: "Contract", value: xsilContract },
  { property: "Block explorer", value: xsilBasescan },
  { property: "Standard", value: "ERC-20 (permit, pausable, AccessControl mint)" },
  { property: "Governance DAO", value: "ExtenSilica DAO on Aragon (Base)" },
  { property: "DAO app", value: ARAGON_DAO_PUBLIC_URL },
  { property: "DAO contract", value: ARAGON_DAO_ADDRESS },
  { property: "Monetary value", value: "None today" },
] as const;

export const TOKEN_DISTRIBUTION_NOTE = `Total supply is 10,000,000 XSIL. There is no vesting, no ICO, and no separate Early Community or Reserve buckets. The founder allocation is minted at deploy; the treasury balance is governed by the ExtenSilica DAO on Aragon and distributed to contributors through governance-approved transfers. ${TOKEN_SUPPLY_FOOTNOTE}`;

export const GOVERNANCE_VOTING_PARAMS = [
  { param: "Voting weight", value: "1 XSIL = 1 vote" },
  { param: "Approval threshold", value: ">50% of votes cast" },
  { param: "Minimum participation", value: "10% of circulating supply" },
  { param: "Voting period", value: "7 days" },
] as const;

export const GOVERNANCE_SCOPE_ITEMS = [
  "Registry policies (portStatus, readiness criteria)",
  "Featured package selection",
  "Future token distribution decisions",
  "Platform roadmap prioritization",
] as const;

export const CLAIM_STEPS = [
  "Earn tokens through eligible contributions (automatically tracked on ExtenSilica).",
  "Sign in at extensilica.com.",
  "Connect an Ethereum-compatible wallet (MetaMask, Coinbase Wallet, WalletConnect, etc.).",
  "Sign a free message to verify wallet ownership (no gas).",
  "Claim pending tokens — a mint transaction is submitted on the Base network to the XSIL contract.",
  "Tokens appear in your connected wallet.",
] as const;

export const FUTURE_LIQUIDITY_COPY = `No ICO is planned today. No exchange listing is scheduled.

But ExtenSilica is being built to last. If it becomes the infrastructure the RISC-V ecosystem runs on, the community of early contributors — the people who were here before it mattered — will hold the governance tokens that shaped it.

What happens next is a decision for that community to make. Not a promise. An open door.`;

export const LEGAL_DISCLAIMER_WHITEPAPER = `${XSIL_LEGAL_DISCLAIMER_LINES.join("\n\n")}

ExtenSilica is an independent project and is not affiliated with RISC-V International.

Acquiring XSIL in expectation of financial return is discouraged. The primary purpose is governance participation and contribution recognition.`;

export const TOKEN_DOC_CONTACT = {
  email: "contact@extensilica.com",
  site: "https://extensilica.com",
  github: "https://github.com/ExtenSilica",
} as const;

export { TOKEN_EARN_ROWS, TOKEN_SUPPLY_ROWS };
