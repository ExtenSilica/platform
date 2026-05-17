import {
  sendOwnershipDecisionEmail,
  type OwnershipDecisionEmailInput,
} from '../mailerOwnership';

type RequesterRow = {
  email: string;
  username: string;
};

type PackageRow = {
  slug: string;
  name: string;
};

type ClaimantOrgRow = {
  slug: string;
  displayName: string;
} | null;

/** Fire-and-forget email to the requester after admin approve/reject. */
export function notifyOwnershipDecisionEmail(
  user: RequesterRow | null | undefined,
  pkg: PackageRow | null | undefined,
  approved: boolean,
  decisionNote: string | null | undefined,
  claimantOrg?: ClaimantOrgRow,
): void {
  if (!user?.email || !pkg?.slug) return;

  const payload: OwnershipDecisionEmailInput = {
    toEmail: user.email,
    toUsername: user.username,
    packageSlug: pkg.slug,
    packageName: pkg.name || pkg.slug,
    approved,
    decisionNote: decisionNote ?? null,
    claimantOrg: claimantOrg ?? null,
  };

  void sendOwnershipDecisionEmail(payload).catch((err) => {
    console.error('[mailer/ownership] failed to send decision email:', err);
  });
}
