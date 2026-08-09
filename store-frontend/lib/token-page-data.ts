/** Static copy for SSR `/token` page (May 2026). */

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
  { action: "Verified simulator support", xsil: "500", notes: "Per accepted Extension/Target record", icon: "check" as const },
  { action: "Verified emulator support", xsil: "750", notes: "Per accepted Extension/Target record", icon: "check" as const },
  { action: "Verified toolchain support", xsil: "1,000", notes: "Per accepted Extension/Target record", icon: "terminal" as const },
  { action: "Verified core implementation", xsil: "1,500", notes: "Target and backend required", icon: "code" as const },
  { action: "Verified hardware evidence", xsil: "2,000", notes: "Reproducible run on a physical board", icon: "building" as const },
  { action: "Validated reference model", xsil: "500", notes: "Accepted semantic comparison oracle", icon: "check" as const },
] as const;

export const WHAT_IS_XSIL = [
  {
    title: "Contribution record",
    body: "Every XSIL token represents verified work that helped an Extension run on a concrete Target. Publishing catalog metadata earns nothing.",
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
