/** Static copy for SSR `/token` page (May 2026). */

export { XSIL_DISCLAIMER_FULL, XSIL_LEGAL_DISCLAIMER } from "@/lib/xsil-disclaimer";

export const TOKEN_SUPPLY_FOOTNOTE =
  "No tokens are sold. No ICO. Tokens are earned through contribution or distributed from treasury via DAO governance decision.";

export const TOKEN_SUPPLY_ROWS = [
  {
    allocation: "Founder",
    amount: "3,000,000",
    pct: "30%",
    notes: "Founder wallet at deploy (30% of total supply)",
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
  { action: "Complete verification run (pass)", xsil: "1,500", notes: "As verifier", icon: "check" as const, automated: true },
  { action: "Paper citing ExtenSilica (documented)", xsil: "3,000", notes: "Admin-verified citation", icon: "book" as const },
  { action: "Contribute code to xsil CLI (merged PR)", xsil: "1,000–5,000", notes: "Discretionary, admin-assigned", icon: "terminal" as const },
  { action: "Vendor official claim (approved)", xsil: "5,000", notes: "Org-level, not per-user", icon: "building" as const },
  { action: "Report valid security issue", xsil: "2,000", notes: "After fix is deployed", icon: "alert" as const },
] as const;

export const WHAT_IS_XSIL = [
  {
    title: "Contribution record",
    body: "Every XSIL token represents a verified action that helped build the ExtenSilica ecosystem — publishing packages, claiming ownership, submitting implementations.",
    icon: "layers" as const,
  },
  {
    title: "Governance participation",
    body: "Token holders vote on platform decisions via the ExtenSilica DAO on Aragon (Base). One token, one vote for eligible proposals.",
    icon: "vote" as const,
  },
  {
    title: "No monetary value today",
    body: "XSIL tokens have no monetary value today and may never have. They are not securities or investments. They record governance participation and contribution history only.",
    icon: "info" as const,
  },
] as const;
