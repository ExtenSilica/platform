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
  total: number;
  byStatus: Record<StandardStatus, number>;
  unclassified: number;
  statusOrder: StandardStatus[];
}

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

export interface UserProfile {
  id: number;
  username: string;
  bio?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
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
