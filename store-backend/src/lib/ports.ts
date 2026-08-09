import type { PortVerificationStatus, TargetKind } from '@prisma/client';
import { prisma } from '../db';

export interface ManifestPortCandidate {
  targetSlug: string;
  targetName: string;
  targetKind: TargetKind;
  backendSlug: string;
  backendName: string | null;
  verificationStatus: PortVerificationStatus;
  testSummary: string | null;
  evidence: string | null;
}

type TargetIdentity = {
  slug: string;
  name: string;
  kind: TargetKind;
  backendSlug: string;
  backendName: string | null;
};

const TARGET_ALIASES: Record<string, TargetIdentity> = {
  spike: { slug: 'spike', name: 'Spike', kind: 'simulator', backendSlug: 'default', backendName: null },
  qemu: { slug: 'qemu', name: 'QEMU', kind: 'emulator', backendSlug: 'default', backendName: null },
  cva6: { slug: 'cva6', name: 'CVA6', kind: 'core', backendSlug: 'default', backendName: null },
  'cva6-cvxif': { slug: 'cva6', name: 'CVA6', kind: 'core', backendSlug: 'cvxif', backendName: 'CV-X-IF' },
  cvxif: { slug: 'cva6', name: 'CVA6', kind: 'core', backendSlug: 'cvxif', backendName: 'CV-X-IF' },
  cv32e40x: { slug: 'cv32e40x', name: 'CV32E40X', kind: 'core', backendSlug: 'default', backendName: null },
  neorv32: { slug: 'neorv32', name: 'NEORV32', kind: 'core', backendSlug: 'default', backendName: null },
  'neorv32-cfu': { slug: 'neorv32', name: 'NEORV32', kind: 'core', backendSlug: 'cfu', backendName: 'CFU' },
  rocket: { slug: 'rocket', name: 'Rocket', kind: 'core', backendSlug: 'default', backendName: null },
  'rocket-rocc': { slug: 'rocket', name: 'Rocket', kind: 'core', backendSlug: 'rocc', backendName: 'RoCC' },
  picorv32: { slug: 'picorv32', name: 'PicoRV32', kind: 'core', backendSlug: 'default', backendName: null },
  'picorv32-pcpi': { slug: 'picorv32', name: 'PicoRV32', kind: 'core', backendSlug: 'pcpi', backendName: 'PCPI' },
  llvm: { slug: 'llvm', name: 'LLVM', kind: 'toolchain', backendSlug: 'default', backendName: null },
  'milk-v-duo': { slug: 'milk-v-duo-c906', name: 'Milk-V Duo / C906', kind: 'board', backendSlug: 'default', backendName: null },
  'milk-v-duo-c906': { slug: 'milk-v-duo-c906', name: 'Milk-V Duo / C906', kind: 'board', backendSlug: 'default', backendName: null },
  reference: { slug: 'reference', name: 'Reference model', kind: 'reference', backendSlug: 'semantic-model', backendName: 'Semantic model' },
};

const DEFAULT_TARGET_BACKENDS: Record<string, { slug: string; name: string }> = {
  cva6: { slug: 'cvxif', name: 'CV-X-IF' },
  neorv32: { slug: 'cfu', name: 'CFU' },
  picorv32: { slug: 'pcpi', name: 'PCPI' },
  rocket: { slug: 'rocc', name: 'RoCC' },
  reference: { slug: 'semantic-model', name: 'Semantic model' },
};

const STATUS_RANK: Record<PortVerificationStatus, number> = {
  declared: 0,
  failed: 1,
  built: 2,
  tested: 3,
  verified: 4,
  archived: 5,
};

export const PORT_REWARD_XSIL: Record<TargetKind, number> = {
  simulator: 500,
  emulator: 750,
  toolchain: 1000,
  core: 1500,
  board: 2000,
  reference: 500,
  other: 1000,
};

export function portRewardForTargetKind(kind: TargetKind): number {
  return PORT_REWARD_XSIL[kind];
}

function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.length <= 4 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function inferKind(slug: string): TargetKind {
  if (slug.includes('spike') || slug.includes('sim')) return 'simulator';
  if (slug.includes('qemu') || slug.includes('emu')) return 'emulator';
  if (slug.includes('llvm') || slug.includes('gcc') || slug.includes('toolchain')) return 'toolchain';
  if (slug.includes('milk-v') || slug.includes('board') || slug.includes('fpga')) return 'board';
  if (slug.includes('reference') || slug.includes('golden')) return 'reference';
  return 'core';
}

function targetIdentity(raw: string) {
  const normalized = slugify(raw);
  return TARGET_ALIASES[normalized] ?? {
    slug: normalized,
    name: titleFromSlug(normalized),
    kind: inferKind(normalized),
    backendSlug: 'default',
    backendName: null,
  };
}

export function resolvePortBackend(input: {
  targetSlug: string;
  backendSlug?: unknown;
  backendName?: unknown;
}): { backendSlug: string; backendName: string | null } {
  const explicitName = typeof input.backendName === 'string' ? input.backendName.trim().slice(0, 80) : '';
  const explicitSlug = typeof input.backendSlug === 'string' ? slugify(input.backendSlug) : '';
  if (explicitSlug || explicitName) {
    const backendSlug = explicitSlug || slugify(explicitName);
    return {
      backendSlug: backendSlug || 'default',
      backendName: explicitName || (backendSlug === 'default' ? null : titleFromSlug(backendSlug)),
    };
  }
  const fallback = DEFAULT_TARGET_BACKENDS[input.targetSlug];
  return fallback
    ? { backendSlug: fallback.slug, backendName: fallback.name }
    : { backendSlug: 'default', backendName: null };
}

function cleanSummary(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 500);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function statusFromTarget(raw: unknown): PortVerificationStatus {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'declared';
  const row = raw as Record<string, unknown>;
  const status = String(row.status ?? '').trim().toLowerCase();
  const build = String(row.build ?? '').trim().toLowerCase();
  const tests = cleanSummary(row.tests);
  const postTest = cleanSummary(row.postTest);

  if (status === 'failed' || status === 'broken' || build === 'failed') return 'failed';
  if (status === 'verified' || (status === 'working' && (tests || postTest))) return 'verified';
  if (tests || postTest || status === 'tested') return 'tested';
  if (build === 'passed' || build === 'pass' || status === 'built') return 'built';
  return 'declared';
}

/** Convert legacy manifest.targets data into explicit Port candidates. */
export function extractManifestPorts(targetsJson: string | null | undefined): ManifestPortCandidate[] {
  if (!targetsJson) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(targetsJson);
  } catch {
    return [];
  }

  const entries: Array<[string, unknown]> = Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === 'string').map((item) => [item, {}])
    : parsed && typeof parsed === 'object'
      ? Object.entries(parsed as Record<string, unknown>)
      : [];

  const candidates = new Map<string, ManifestPortCandidate>();
  for (const [rawTarget, data] of entries) {
    const identity = targetIdentity(rawTarget);
    if (!identity.slug) continue;
    const row = data && typeof data === 'object' && !Array.isArray(data)
      ? data as Record<string, unknown>
      : {};
    const testSummary = [cleanSummary(row.tests), cleanSummary(row.postTest)]
      .filter((value): value is string => Boolean(value))
      .join(' | ') || null;
    const candidate: ManifestPortCandidate = {
      targetSlug: identity.slug,
      targetName: identity.name,
      targetKind: identity.kind,
      backendSlug: identity.backendSlug,
      backendName: identity.backendName,
      verificationStatus: statusFromTarget(data),
      testSummary,
      evidence: Object.keys(row).length > 0 ? JSON.stringify(row) : null,
    };
    const candidateKey = `${identity.slug}:${identity.backendSlug}`;
    const previous = candidates.get(candidateKey);
    if (!previous || STATUS_RANK[candidate.verificationStatus] > STATUS_RANK[previous.verificationStatus]) {
      candidates.set(candidateKey, candidate);
    }
  }
  return Array.from(candidates.values());
}

/** Keep the explicit Port matrix in sync with a newly published Version. */
export async function syncPortsFromVersion(input: {
  extensionId: number;
  versionId: number;
  targets: string | null;
  toolchain: string | null;
  contributorId: number | null;
}): Promise<number> {
  const candidates = extractManifestPorts(input.targets);
  for (const candidate of candidates) {
    const target = await prisma.target.upsert({
      where: { slug: candidate.targetSlug },
      create: {
        slug: candidate.targetSlug,
        name: candidate.targetName,
        kind: candidate.targetKind,
      },
      update: {},
    });

    const existing = await prisma.port.findUnique({
      where: {
        extensionId_targetId_backendSlug: {
          extensionId: input.extensionId,
          targetId: target.id,
          backendSlug: candidate.backendSlug,
        },
      },
      select: { verificationStatus: true, implementationRequestId: true },
    });
    // A formally verified Port is an auditable result tied to a request and
    // contributor. Manifest backfills must never rewrite that evidence.
    if (existing?.verificationStatus === 'verified' && existing.implementationRequestId) {
      continue;
    }
    const nextStatus = existing && STATUS_RANK[existing.verificationStatus] > STATUS_RANK[candidate.verificationStatus]
      ? existing.verificationStatus
      : candidate.verificationStatus;

    await prisma.port.upsert({
      where: {
        extensionId_targetId_backendSlug: {
          extensionId: input.extensionId,
          targetId: target.id,
          backendSlug: candidate.backendSlug,
        },
      },
      create: {
        extensionId: input.extensionId,
        targetId: target.id,
        backendSlug: candidate.backendSlug,
        backendName: candidate.backendName,
        versionId: input.versionId,
        contributorId: input.contributorId,
        verificationStatus: nextStatus,
        testSummary: candidate.testSummary,
        toolchain: input.toolchain,
        evidence: candidate.evidence,
        verifiedAt: nextStatus === 'verified' ? new Date() : null,
      },
      update: {
        backendName: candidate.backendName,
        versionId: input.versionId,
        contributorId: input.contributorId,
        verificationStatus: nextStatus,
        testSummary: candidate.testSummary,
        toolchain: input.toolchain,
        evidence: candidate.evidence,
        ...(nextStatus === 'verified' ? { verifiedAt: new Date() } : {}),
      },
    });
  }
  return candidates.length;
}
