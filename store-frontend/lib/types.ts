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
