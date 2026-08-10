/** Static copy for SSR `/token` page (August 2026). */

export { XSIL_DISCLAIMER_FULL, XSIL_LEGAL_DISCLAIMER } from "@/lib/xsil-disclaimer";

export const TOKEN_SUPPLY_FOOTNOTE =
  "No tokens are sold. No ICO. Tokens are earned through contribution or distributed from treasury via DAO governance decision.";

export const TOKEN_DISTRIBUTION_INTRO =
  "Total supply is 10,000,000 XSIL. The founder allocation is issued at deploy; the remaining supply is held in the ExtenSilica DAO treasury on Aragon and distributed to contributors through governance-approved transfers.";

export const GOVERNANCE_VOTING_PARAMS = [
  { param: "Voting weight", value: "1 XSIL = 1 vote" },
  { param: "Approval threshold", value: ">50% of votes cast" },
  { param: "Minimum participation", value: "15% (1,500,000 XSIL)" },
  { param: "Voting period", value: "7 days" },
] as const;

export const TOKEN_SUPPLY_ROWS = [
  {
    allocation: "Founder",
    amount: "3,000,000",
    pct: "30%",
    notes: "Minted to founder wallet at deploy",
  },
  {
    allocation: "Treasury / DAO",
    amount: "7,000,000",
    pct: "70%",
    notes:
      "Held by ExtenSilica DAO on Aragon; distributed to contributors via governance-approved transfers",
  },
  {
    allocation: "Total",
    amount: "10,000,000",
    pct: "100%",
    notes: "",
    total: true,
  },
] as const;

export const TOKEN_EARN_ROWS = [
  { action: "Maintain an upstream package", xsil: "Reviewed", notes: "Ownership and provenance must be verified", icon: "check" as const },
  { action: "Package a real extension", xsil: "Reviewed", notes: "Complete, attributable, non-duplicate .xsil archive", icon: "layers" as const },
  { action: "Add simulator or toolchain artifacts", xsil: "Reviewed", notes: "Reproducible files, versions, and checksums", icon: "terminal" as const },
  { action: "Add tests or examples", xsil: "Reviewed", notes: "Useful engineering evidence attached to a package", icon: "code" as const },
  { action: "Update specifications or encodings", xsil: "Reviewed", notes: "Verified correction or upstream version update", icon: "check" as const },
  { action: "Improve the registry", xsil: "Reviewed", notes: "Accepted platform code, documentation, or curation", icon: "building" as const },
] as const;

export const WHAT_IS_XSIL = [
  {
    title: "Contribution record",
    body: "Every XSIL token represents reviewed engineering work that improved a real extension package or the registry itself. Empty metadata earns nothing.",
    icon: "layers" as const,
  },
  {
    title: "Governance participation",
    body: "Token holders vote on platform decisions via the ExtenSilica DAO on Aragon (Base). One token, one vote for eligible proposals.",
    icon: "vote" as const,
  },
  {
    title: "Contribution, not payment",
    body: "XSIL tokens have no monetary value today and may never have. They are not securities or investments. They record governance participation and contribution history only.",
    icon: "info" as const,
  },
] as const;
