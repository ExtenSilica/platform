/** Static copy for SSR `/token` page (spec May 2026). */

export { XSIL_DISCLAIMER_FULL, XSIL_LEGAL_DISCLAIMER } from "@/lib/xsil-disclaimer";

export const TOKEN_SUPPLY_ROWS = [
  { allocation: "Founder (vesting)", amount: "3,000,000", pct: "30%", notes: "4-year vest, 1-year cliff" },
  { allocation: "Contributors", amount: "4,000,000", pct: "40%", notes: "Earned via platform actions" },
  { allocation: "Early Community", amount: "2,000,000", pct: "20%", notes: "First 12 months of activity" },
  { allocation: "Reserve / Future DAO", amount: "1,000,000", pct: "10%", notes: "Future governance decision" },
  { allocation: "Total", amount: "10,000,000", pct: "100%", notes: "", total: true },
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
    body: "Token holders vote on platform decisions: feature priorities, portStatus policies, featured packages, registry guidelines. One token, one vote.",
    icon: "vote" as const,
  },
  {
    title: "No monetary value today",
    body: "XSIL tokens have no monetary value today and may never have. They are not securities or investments. They record governance participation and contribution history only.",
    icon: "info" as const,
  },
] as const;
