export interface RegistryVersion {
  id: number;
  version: string;
  changelog?: string | null;
  xsilUrl?: string | null;
  checksum?: string | null;
  checksumPayload?: string | null;
  isa?: string | null;
  toolchain?: string | null;
  targets?: string | null;
  execution?: string | null;
  dependencies?: string | null;
  resolutionMode?: string | null;
  readinessLevel?: number | null;
  capabilities?: string | null;
  /** Canonical JSON array from optional `manifest.evidence` at publish. */
  evidence?: string | null;
  size?: number | null;
  downloadCount: number;
  isYanked: boolean;
  yankReason?: string | null;
  publishedAt: string;
}

/**
 * Honest classification of a package's relationship to the RISC-V standard.
 * Matches the Prisma `StandardStatus` enum and the CLI's `manifest.standardStatus`.
 */
export type StandardStatus =
  | "ratified"
  | "draft"
  | "vendor"
  | "research"
  | "custom";

export const STANDARD_STATUS_VALUES: StandardStatus[] = [
  "ratified",
  "draft",
  "vendor",
  "research",
  "custom",
];

/** Display metadata for a `StandardStatus`, used in badges, filters, hero copy. */
export const STANDARD_STATUS_INFO: Record<
  StandardStatus,
  { label: string; description: string }
> = {
  ratified: {
    label: "Ratified",
    description:
      "Frozen specification approved by RISC-V International. The encoding is locked; future changes go into a separate extension.",
  },
  draft: {
    label: "Draft",
    description:
      "Working draft from RISC-V International or another standards body. Not ratified yet — the encoding may still change.",
  },
  vendor: {
    label: "Vendor",
    description:
      "Custom extension defined and shipped by a commercial vendor (T-Head, SiFive, Qualcomm, …).",
  },
  research: {
    label: "Research",
    description:
      "Academic / experimental extension. Often used in research papers or pre-production prototypes.",
  },
  custom: {
    label: "Custom",
    description:
      "Bespoke or one-off extension that does not fit the categories above.",
  },
};

export interface CatalogStats {
  extensions: number;
  verifiedPorts: number;
  targets: number;
  /** @deprecated Use extensions. */
  total: number;
  byStatus: Record<StandardStatus, number>;
  unclassified: number;
  statusOrder: StandardStatus[];
}

export interface AdoptionDailyPoint {
  day: string;
  count: number;
}

export interface AdoptionStats {
  days: number;
  totalPackages: number;
  views: {
    windowTotal: number;
    last7Days: number;
    last30Days: number;
    daily: AdoptionDailyPoint[];
  };
  downloads: {
    windowTotal: number;
    last7Days: number;
    last30Days: number;
    daily: AdoptionDailyPoint[];
  };
  topPackagesByViews: Array<{
    slug: string;
    name: string;
    viewsInWindow: number;
  }>;
}

/**
 * Provenance of a package on ExtenSilica — orthogonal to StandardStatus.
 * Always server-set; never carried by the .xsil manifest.
 */
export type PortStatus =
  | "seeded"
  | "community_port"
  | "claimed"
  | "official"
  | "archived";

export const PORT_STATUS_VALUES: PortStatus[] = [
  "seeded",
  "community_port",
  "claimed",
  "official",
  "archived",
];

export const PORT_STATUS_INFO: Record<
  PortStatus,
  { label: string; short: string; description: string }
> = {
  seeded: {
    label: "Seeded · unverified",
    short: "Seeded",
    description:
      "Auto-published from upstream by the ExtenSilica catalog-seed agent. The original maintainer has not (yet) claimed authorship.",
  },
  community_port: {
    label: "Community port",
    short: "Community",
    description:
      "Ported by a non-upstream community member. Useful, but not vetted as official.",
  },
  claimed: {
    label: "Maintainer claimed",
    short: "Claimed",
    description:
      "The current owner went through the Request authorship flow and was approved by a platform admin.",
  },
  official: {
    label: "Official",
    short: "Official",
    description:
      "Platform admin has verified the publisher's identity / affiliation with the upstream project.",
  },
  archived: {
    label: "Archived",
    short: "Archived",
    description:
      "Upstream is dead or the package has been intentionally frozen. Still installable; no further updates expected.",
  },
};

export type TargetKind =
  | "simulator"
  | "emulator"
  | "core"
  | "board"
  | "toolchain"
  | "reference"
  | "other";

export const PORT_REWARD_XSIL_BY_TARGET_KIND: Record<TargetKind, number> = {
  simulator: 500,
  emulator: 750,
  toolchain: 1000,
  core: 1500,
  board: 2000,
  reference: 500,
  other: 1000,
};

export type PortVerificationStatus =
  | "declared"
  | "built"
  | "tested"
  | "verified"
  | "failed"
  | "archived";

export interface RegistryTarget {
  id: number;
  slug: string;
  name: string;
  kind: TargetKind;
  description?: string | null;
  homepageUrl?: string | null;
  architecture?: string | null;
  portCount: number;
  verifiedPortCount: number;
  openPortRequestCount: number;
  availableRewardXsil: number;
}

export interface RegistryPort {
  id: number;
  extensionId: number;
  targetId: number;
  target: RegistryTarget;
  versionId?: number | null;
  version?: string | null;
  contributor?: { id: number; username: string; avatarUrl?: string | null } | null;
  verificationStatus: PortVerificationStatus;
  testSummary?: string | null;
  toolchain?: string | null;
  sourceUrl?: string | null;
  evidenceUrl?: string | null;
  evidence?: string | null;
  rewardXsil?: number | null;
  verifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Required when an admin sets `portStatus` to `official` (PR-C4). */
export const PORT_STATUS_DECISION_NOTE_MIN = 10;
export const PORT_STATUS_DECISION_NOTE_MAX = 1000;

export interface RegistryPackage {
  id: number;
  slug: string;
  name: string;
  description: string;
  shortDescription?: string | null;
  longDescription?: string | null;
  author?: string | null;
  ownerId?: number | null;
  iconUrl?: string | null;
  icon?: string | null;
  keywords?: string[] | null;
  license?: string | null;
  repositoryUrl?: string | null;
  homepageUrl?: string | null;
  /** Honest classification (see StandardStatus). Null for legacy packages. */
  standardStatus?: StandardStatus | null;
  /** Free-text spec authority, e.g. "RISC-V International", "T-Head / XuanTie". */
  authority?: string | null;
  /** Provenance on ExtenSilica (server-set; never from the manifest). */
  portStatus?: PortStatus | null;
  /** Clear public name for the legacy portStatus provenance field. */
  provenance?: PortStatus | null;
  /** Audit note when `portStatus` is `official` (platform admin). */
  portStatusDecisionNote?: string | null;
  portStatusDecidedAt?: string | null;
  latestVersion?: string | null;
  version?: string;
  totalDownloads: number;
  weeklyDownloads: number;
  isDeprecated: boolean;
  deprecationMessage?: string | null;
  reviewCount?: number;
  averageRating?: number | null;
  createdAt: string;
  updatedAt: string;
  versions: RegistryVersion[];
  ports?: RegistryPort[];
  verifiedPortCount?: number;
  /** Present when the registry includes org scope on list/detail responses. */
  org?: { slug: string; displayName: string } | null;
}

export interface Review {
  id: number;
  packageId?: number;
  userId: number;
  username?: string | null;
  avatarUrl?: string | null;
  rating: number;
  comment?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface PackageStats {
  slug: string;
  allTime: number;
  last7Days: number;
  last30Days: number;
  dailyHistory?: Array<{ day: string; count: number }> | null;
  byVersion?: Array<{ version: string; count90Days: number }> | null;
}

export type ExtensionConflictType =
  | "OPCODE"
  | "PARTIAL_DECODE_OVERLAP"
  | "OPCODE_SHARED"
  | "SHARED_MAJOR_OPCODE"
  | "SHARED_CUSTOM_SPACE"
  | "CSR"
  // legacy values still possible from older cached payloads:
  | "CUSTOM_SPACE";
export type ExtensionConflictSeverity = "FATAL" | "WARNING" | "INFO";

/** Only these collision types are confirmed conflicts; everything else is
 *  overlap / shared-space metadata. Mirrors the backend's CONFLICT_TYPES. */
export const REAL_CONFLICT_TYPES: ReadonlySet<ExtensionConflictType> = new Set([
  "OPCODE",
  "CSR",
]);

export function isRealConflict(t: ExtensionConflictType): boolean {
  return REAL_CONFLICT_TYPES.has(t);
}

export interface CollisionGraphNode {
  id: string;
  slug: string;
  name: string;
  version: string | null;
  rl: number | null;
  portStatus: string | null;
  standardStatus: string | null;
  coupling: string;
  dispatch: string;
  encodingSpace: string[];
}

export interface CollisionGraphEdge {
  source: string;
  target: string;
  type: ExtensionConflictType;
  severity: ExtensionConflictSeverity;
  detail: string;
}

export interface CollisionGraph {
  generatedAt: string;
  nodes: CollisionGraphNode[];
  edges: CollisionGraphEdge[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    /** Edges that are confirmed conflicts (OPCODE / CSR). Optional for back-compat. */
    conflictEdgeCount?: number;
    byTypeSeverity: Record<string, number>;
  };
}

export interface ExtensionConflict {
  withExtensionId: string;
  withExtensionName: string;
  type: ExtensionConflictType;
  detail: string;
  severity: ExtensionConflictSeverity;
}

export interface ExtensionConflictsResponse {
  extensionId: string;
  extensionName: string;
  conflicts: ExtensionConflict[];
  checkedAt: string;
}

export interface UserContributionRequest {
  id: number;
  title: string;
  status: ImplementationRequestStatus;
  packageSlug: string;
  packageName: string;
  createdAt: string;
}

export interface UserContributionSubmission {
  id: number;
  requestId: number;
  requestTitle: string;
  packageSlug: string;
  packageName: string;
  status: ImplementationSubmissionStatus;
  submittedAt: string | null;
  latestVerificationOutcome: VerificationRunOutcome | null;
}

export interface UserContributionVerification {
  id: number;
  submissionId: number;
  requestId: number;
  requestTitle: string;
  packageSlug: string;
  packageName: string;
  outcome: VerificationRunOutcome;
  createdAt: string;
}

export interface UserContributions {
  username: string;
  requestsCreated: UserContributionRequest[];
  submissions: UserContributionSubmission[];
  verifications: UserContributionVerification[];
}

export interface UserProfileXsilGrant {
  id: string;
  amount: number;
  reason: string;
  reasonLabel?: string;
  referenceId: string;
  status: string;
  createdAt: string;
}

export interface UserProfileXsil {
  totalEarned: number;
  claimedOnChain: number;
  pendingClaim: number;
  grants: UserProfileXsilGrant[];
}

export interface UserProfile {
  id: number;
  username: string;
  bio?: string | null;
  avatarUrl?: string | null;
  implementerGithubUrl?: string | null;
  implementerBio?: string | null;
  createdAt: string;
  xsil?: UserProfileXsil;
  packages: Array<{
    slug: string;
    name: string;
    description: string;
    latestVersion?: string | null;
    totalDownloads: number;
    weeklyDownloads: number;
    /** RL 1–5 (preferred; same value as legacy maturityLevel). */
    readinessLevel: number;
    /** @deprecated Same integer as readinessLevel; kept for older API clients. */
    maturityLevel: number;
    capabilityBadges: string[];
  }>;
}

export interface OrgMember {
  id: number;
  orgId: number;
  userId: number;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  user: {
    id: number;
    username: string;
    avatarUrl?: string | null;
  };
}

export type OwnershipRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'withdrawn';

export interface OwnershipRequestUserSummary {
  id: number;
  username: string;
  email: string;
  avatarUrl?: string | null;
}

export interface OwnershipRequestPackageSummary {
  id: number;
  slug: string;
  name: string;
  description: string;
  iconUrl?: string | null;
  ownerId?: number | null;
  orgId?: number | null;
  author?: string | null;
  org?: { id: number; slug: string; displayName: string } | null;
}

export interface OwnershipRequestOrgSummary {
  id: number;
  slug: string;
  displayName: string;
}

export interface OwnershipRequest {
  id: number;
  packageId: number;
  userId: number;
  reason: string;
  evidenceUrl?: string | null;
  status: OwnershipRequestStatus;
  decisionNote?: string | null;
  decidedById?: number | null;
  decidedAt?: string | null;
  claimantOrgId?: number | null;
  claimantOrg?: OwnershipRequestOrgSummary | null;
  createdAt: string;
  updatedAt: string;
  package?: OwnershipRequestPackageSummary;
  user?: OwnershipRequestUserSummary | null;
  decidedBy?: OwnershipRequestUserSummary | null;
}

export type OwnershipEligibility =
  | { eligible: true }
  | {
      eligible: false;
      reason: string;
      /** Set when the only blocker is "not signed in". */
      requiresAuth?: boolean;
    };

/* ─── Implementation coordination (Phase C) ─────────────────────────────── */

export type ImplementationRequestVisibility = "public" | "org_only" | "unlisted";

export const IMPLEMENTATION_REQUEST_VISIBILITIES: ImplementationRequestVisibility[] = [
  "public",
  "org_only",
  "unlisted",
];

export type ImplementationRequestStatus =
  | "draft"
  | "open"
  | "in_progress"
  | "submitted"
  | "verified"
  | "completed"
  | "cancelled";

export const IMPLEMENTATION_REQUEST_STATUSES: ImplementationRequestStatus[] = [
  "draft",
  "open",
  "in_progress",
  "submitted",
  "verified",
  "completed",
  "cancelled",
];

export type ImplementationSubmissionStatus = "draft" | "submitted";

export const IMPLEMENTATION_SUBMISSION_STATUSES: ImplementationSubmissionStatus[] = [
  "draft",
  "submitted",
];

export type VerificationRunOutcome = "pass" | "fail";

export const VERIFICATION_RUN_OUTCOMES: VerificationRunOutcome[] = ["pass", "fail"];

/** Field length limits (mirror store-backend `lib/implementationRequest.ts`). */
export const IMPLEMENTATION_TITLE_MIN = 5;
export const IMPLEMENTATION_TITLE_MAX = 200;
export const IMPLEMENTATION_DESCRIPTION_MIN = 50;
export const IMPLEMENTATION_DESCRIPTION_MAX = 10000;
export const IMPLEMENTATION_TARGET_CAPABILITY_MAX = 120;
export const IMPLEMENTATION_ACCEPTANCE_CRITERIA_MAX = 4000;
export const IMPLEMENTATION_FUNDING_NOTE_MAX = 2000;
export const IMPLEMENTATION_SUBMISSION_SUMMARY_MIN = 50;
export const IMPLEMENTATION_SUBMISSION_SUMMARY_MAX = 10000;
export const IMPLEMENTATION_INTEREST_MESSAGE_MAX = 500;
export const IMPLEMENTATION_VERIFICATION_NOTES_MAX = 4000;

export function isTerminalImplementationRequestStatus(
  status: ImplementationRequestStatus,
): boolean {
  return status === "completed" || status === "cancelled";
}

export const IMPLEMENTATION_REQUEST_STATUS_INFO: Record<
  ImplementationRequestStatus,
  { label: string; description: string }
> = {
  draft: {
    label: "Draft",
    description: "Visible only to the creator until published as open.",
  },
  open: {
    label: "Open",
    description: "Accepting implementer interest and work proposals.",
  },
  in_progress: {
    label: "In progress",
    description: "Assigned or active implementation work.",
  },
  submitted: {
    label: "Submitted",
    description: "Deliverable submitted; awaiting verification.",
  },
  verified: {
    label: "Verified",
    description: "Technical verification passed; upstream may close the request.",
  },
  completed: {
    label: "Completed",
    description: "Request closed successfully.",
  },
  cancelled: {
    label: "Cancelled",
    description: "Request withdrawn or closed without completion.",
  },
};

export interface ImplementationUserSummary {
  id: number;
  username: string;
  avatarUrl?: string | null;
  implementerGithubUrl?: string | null;
}

export interface ImplementationPackageSummary {
  id: number;
  slug: string;
  name: string;
  ownerId?: number | null;
  orgId?: number | null;
}

export interface ImplementationOrgSummary {
  id: number;
  slug: string;
  displayName: string;
}

export interface ImplementationMilestone {
  id: number;
  title: string;
  description?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ImplementationRequest {
  id: number;
  packageId: number;
  createdByUserId: number;
  createdByOrgId?: number | null;
  title: string;
  description: string;
  visibility: ImplementationRequestVisibility;
  status: ImplementationRequestStatus;
  targetCapability?: string | null;
  targetId?: number | null;
  target?: Pick<RegistryTarget, "id" | "slug" | "name" | "kind"> | null;
  rewardXsil?: number | null;
  acceptanceCriteriaSummary?: string | null;
  fundingContactEmail?: string | null;
  fundingNote?: string | null;
  assignedImplementerUserId?: number | null;
  openedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  package?: ImplementationPackageSummary;
  createdBy?: ImplementationUserSummary;
  createdByOrg?: ImplementationOrgSummary | null;
  assignedImplementer?: ImplementationUserSummary | null;
  milestones?: ImplementationMilestone[];
  interestCount: number;
  submissionCount: number;
}

export interface ImplementationInterest {
  id: number;
  requestId: number;
  userId: number;
  message?: string | null;
  createdAt: string;
}

export interface VerificationRun {
  id: number;
  submissionId?: number;
  verifierId: number;
  outcome: VerificationRunOutcome;
  notes?: string | null;
  logUrl?: string | null;
  createdAt: string;
}

export interface ImplementationSubmission {
  id: number;
  requestId: number;
  submittedById: number;
  status: ImplementationSubmissionStatus;
  summary: string;
  evidenceUrl?: string | null;
  versionId?: number | null;
  submittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  submittedBy?: ImplementationUserSummary;
  request?: {
    id: number;
    packageId: number;
    status: ImplementationRequestStatus;
    title: string;
    package: ImplementationPackageSummary;
  };
  verificationRuns?: VerificationRun[];
}

export interface CreateImplementationRequestInput {
  title: string;
  description: string;
  visibility?: ImplementationRequestVisibility;
  targetCapability?: string | null;
  targetId?: number | null;
  rewardXsil?: number | null;
  acceptanceCriteriaSummary?: string | null;
  fundingContactEmail?: string | null;
  fundingNote?: string | null;
  createdByOrgId?: number | null;
}

export interface PatchImplementationRequestInput {
  title?: string;
  description?: string;
  visibility?: ImplementationRequestVisibility;
  targetCapability?: string | null;
  targetId?: number | null;
  rewardXsil?: number | null;
  acceptanceCriteriaSummary?: string | null;
  fundingContactEmail?: string | null;
  fundingNote?: string | null;
  assignedImplementerUserId?: number | null;
  status?: ImplementationRequestStatus;
}

export type ExternalCitationKind = "doi" | "paper" | "website" | "other";

export const EXTERNAL_CITATION_KINDS: ExternalCitationKind[] = [
  "doi",
  "paper",
  "website",
  "other",
];

export interface ExternalCitation {
  id: number;
  packageId: number | null;
  label: string;
  url: string;
  kind: ExternalCitationKind;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
  package?: { id: number; slug: string; name: string } | null;
  createdBy?: { id: number; username: string };
}

export interface CreateExternalCitationInput {
  label: string;
  url: string;
  kind: ExternalCitationKind;
  packageSlug?: string | null;
  packageId?: number | null;
}

export interface PackageCitationAuthor {
  name: string;
}

export interface PackageCitation {
  slug: string;
  version: string;
  title: string;
  license: string | null;
  registryPageUrl: string;
  repositoryUrl: string | null;
  doi: string | null;
  authors: PackageCitationAuthor[];
  cff: string;
  bibtex: string;
}

export interface Organization {
  id: number;
  slug: string;
  displayName: string;
  description?: string | null;
  avatarUrl?: string | null;
  websiteUrl?: string | null;
  linkedinUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  members: OrgMember[];
  packages: Array<{
    id: number;
    slug: string;
    name: string;
    description: string;
    latestVersion?: string | null;
    totalDownloads: number;
    weeklyDownloads: number;
    isDeprecated: boolean;
    createdAt: string;
    /** RL 1–5 (preferred; same value as legacy maturityLevel). */
    readinessLevel: number;
    /** @deprecated Same integer as readinessLevel; kept for older API clients. */
    maturityLevel: number;
    capabilityBadges: string[];
  }>;
}

/** Returned by GET /auth/me/orgs — org summary with the user's own role */
export interface MyOrg {
  id: number;
  slug: string;
  displayName: string;
  avatarUrl?: string | null;
  linkedinUrl?: string | null;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  _count: { members: number; packages: number };
}

export type XsilPackage = RegistryPackage;
export type XsilVersion = RegistryVersion;

export interface DeclaredManifestTarget {
  id: string;
  bitstream?: string;
}

export function parseDeclaredManifestTargets(
  targets: unknown
): DeclaredManifestTarget[] {
  if (!targets) return [];
  if (Array.isArray(targets)) return targets as DeclaredManifestTarget[];
  if (typeof targets === "string") {
    try {
      const j = JSON.parse(targets) as unknown;
      return Array.isArray(j) ? (j as DeclaredManifestTarget[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}
