/** Display helpers for XSIL grants (dashboard + public profile). */

const REASON_LABELS: Record<string, string> = {
  FIRST_PACKAGE_PUBLISH: "First package published",
  PACKAGE_PUBLISH: "Package published",
  OWNERSHIP_CLAIM_APPROVED: "Ownership claim approved",
  IMPLEMENTATION_SUBMISSION_ACCEPTED: "Implementation accepted",
  VERIFICATION_RUN_COMPLETED: "Verification run completed",
  EXTERNAL_CITATION_VERIFIED: "External citation verified",
  CODE_CONTRIBUTION_MERGED: "Code contribution merged",
  VENDOR_CLAIM_APPROVED: "Vendor official claim",
  SECURITY_REPORT_FIXED: "Security report fixed",
  ADMIN_DISCRETIONARY: "Admin discretionary grant",
};

export function grantReasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason.replace(/_/g, " ").toLowerCase();
}

export function formatGrantReference(referenceId: string): string {
  const ref = referenceId.trim();
  if (ref.startsWith("package:")) return ref.slice("package:".length);
  if (ref.startsWith("version:")) {
    const parts = ref.split(":");
    if (parts.length >= 3) return `package #${parts[1]} @ ${parts[2]}`;
    return ref;
  }
  if (ref.startsWith("ownership:")) return `ownership #${ref.slice("ownership:".length)}`;
  if (ref.startsWith("submission:")) return `submission #${ref.slice("submission:".length)}`;
  if (ref.startsWith("verification:")) return `verification #${ref.slice("verification:".length)}`;
  return ref;
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.floor((now - then) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? "" : "s"} ago`;
  const yr = Math.floor(mo / 12);
  return `${yr} year${yr === 1 ? "" : "s"} ago`;
}

function basescanBaseUrl(): string {
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID ?? "8453";
  if (chainId === "84532") return "https://sepolia.basescan.org";
  return "https://basescan.org";
}

export function basescanAddressUrl(address: string): string {
  return `${basescanBaseUrl()}/address/${address}`;
}

export function basescanTxUrl(txHash: string): string {
  return `${basescanBaseUrl()}/tx/${txHash}`;
}
