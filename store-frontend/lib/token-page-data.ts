/** Static copy for SSR `/token` page (August 2026). */

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
  { action: "Publish first package", xsil: "500", notes: "One-time per user", icon: "package" as const },
  { action: "Publish each additional package", xsil: "200", notes: "Per new package", icon: "package" as const },
  { action: "Claim upstream ownership (approved)", xsil: "1,000", notes: "After admin approval", icon: "shield" as const },
  { action: "Submit implementation (accepted)", xsil: "2,000", notes: "After verifier approval", icon: "code" as const },
  { action: "Complete verification run (pass)", xsil: "1,500", notes: "As verifier", icon: "check" as const },
  { action: "Paper citing ExtenSilica (documented)", xsil: "3,000", notes: "Admin-verified citation", icon: "book" as const },
  { action: "Contribute code to xsil CLI (merged PR)", xsil: "1,000–5,000", notes: "Based on scope, admin-assigned", icon: "terminal" as const },
  { action: "Vendor official claim (approved)", xsil: "5,000", notes: "Organization-level grant", icon: "building" as const },
  { action: "Report valid security issue", xsil: "2,000", notes: "After the fix is deployed", icon: "alert" as const },
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
    title: "Earned, not sold",
    body: "XSIL is not sold by ExtenSilica. Contributors earn it through reviewed engineering work. Its current role is governance and contribution recognition; ExtenSilica makes no promise about any future market value.",
    icon: "info" as const,
  },
] as const;
