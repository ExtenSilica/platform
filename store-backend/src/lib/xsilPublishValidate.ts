/**
 * Server-side `.xsil` checks for `POST /packages/:name/versions`.
 *
 * Extraction uses the **system `tar`** binary (`tar -xzf`) so the host image must
 * include GNU/BSD tar (normal on Linux deploy bases).
 */
import * as crypto from 'crypto';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import ignore from 'ignore';
import * as os from 'os';
import * as path from 'path';
import * as semver from 'semver';

/** Thrown when a `.xsil` upload fails structural / integrity checks (HTTP 400). */
export class XsilValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XsilValidationError';
  }
}

/** Built-in exclusions — aligned with `cli/src/manager.rs` (`IgnoreRules::BUILTIN`). */
const BUILTIN_IGNORE_BLOCK = ['.git/', '.xsilignore', '.DS_Store', 'Thumbs.db'].join('\n');

/**
 * `.xsilignore` uses gitignore-like syntax; the `ignore` package matches the CLI
 * implementation closely enough that payload hashes stay consistent with `xsil publish`.
 */
function loadIgnoreFilter(packageRoot: string) {
  const ig = ignore();
  ig.add(BUILTIN_IGNORE_BLOCK);
  const p = path.join(packageRoot, '.xsilignore');
  if (fs.existsSync(p)) {
    ig.add(fs.readFileSync(p, 'utf8'));
  }
  return ig;
}

function collectPayloadFiles(rootAbs: string, ig: ReturnType<typeof ignore>): string[] {
  const out: string[] = [];

  const walk = (dirAbs: string, relPosix: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const name = ent.name;
      const rel = relPosix ? `${relPosix}/${name}` : name;
      if (ent.isDirectory()) {
        if (ig.ignores(rel + '/')) continue;
        walk(path.join(dirAbs, name), rel);
      } else {
        if (ig.ignores(rel)) continue;
        out.push(path.join(dirAbs, name));
      }
    }
  };

  walk(rootAbs, '');
  // Match Rust `PathBuf` sort (byte / `Ord`), not `localeCompare` (locale-dependent).
  out.sort((a, b) => {
    const ra = path.relative(rootAbs, a).split(path.sep).join('/');
    const rb = path.relative(rootAbs, b).split(path.sep).join('/');
    if (ra < rb) return -1;
    if (ra > rb) return 1;
    return 0;
  });
  return out;
}

function isRootManifest(absPath: string, rootAbs: string): boolean {
  const base = path.basename(absPath);
  if (base !== 'manifest.json') return false;
  const parent = path.dirname(absPath);
  try {
    return fs.realpathSync(parent) === fs.realpathSync(rootAbs);
  } catch {
    return path.normalize(parent) === path.normalize(rootAbs);
  }
}

/**
 * SHA-256 over the concatenation of file contents (sorted by relative POSIX path),
 * excluding the root `manifest.json`, matching `ExtensionManager::compute_payload_hash`.
 */
export function computePayloadHashFromDir(packageRoot: string): string {
  const ig = loadIgnoreFilter(packageRoot);
  const files = collectPayloadFiles(packageRoot, ig);
  const hash = crypto.createHash('sha256');
  for (const abs of files) {
    if (isRootManifest(abs, packageRoot)) continue;
    hash.update(fs.readFileSync(abs));
  }
  return hash.digest('hex');
}

function stripSha256Prefix(s: string): string {
  let t = s.trim();
  if (t.toLowerCase().startsWith('sha256:')) t = t.slice(7);
  else if (t.toLowerCase().startsWith('sha256-')) t = t.slice(7);
  return t.trim();
}

export interface ManifestJson {
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  isa?: string;
  entry?: string;
  testEntry?: string;
  toolchain?: unknown;
  targets?: unknown;
  execution?: unknown;
  dependencies?: unknown;
  resolution?: unknown;
  payloadHash?: string;
  checksums?: { payload?: string; archive?: string };
}

function effectiveDeclaredPayloadHash(m: ManifestJson): string {
  const fromChecksums = m.checksums?.payload;
  if (fromChecksums != null && String(fromChecksums).trim() !== '') {
    return stripSha256Prefix(String(fromChecksums));
  }
  return stripSha256Prefix(m.payloadHash ?? '');
}

function readManifest(packageRoot: string): ManifestJson {
  const mp = path.join(packageRoot, 'manifest.json');
  if (!fs.existsSync(mp)) {
    throw new XsilValidationError('Archive is missing manifest.json at the root.');
  }
  let raw: string;
  try {
    raw = fs.readFileSync(mp, 'utf8');
  } catch {
    throw new XsilValidationError('Could not read manifest.json.');
  }
  try {
    return JSON.parse(raw) as ManifestJson;
  } catch {
    throw new XsilValidationError('manifest.json is not valid JSON.');
  }
}

function validatePublishManifestFields(m: ManifestJson): void {
  const name = (m.name ?? '').trim();
  const version = (m.version ?? '').trim();
  const description = (m.description ?? '').trim();
  const author = (m.author ?? '').trim();
  const legacyEntry = m.entry != null ? String(m.entry).trim() : '';
  const exec = m.execution as Record<string, unknown> | undefined;
  const execEntry =
    exec && typeof exec === 'object' && typeof exec.entry === 'string'
      ? String(exec.entry).trim()
      : '';
  const entry = execEntry || legacyEntry;

  if (!name) throw new XsilValidationError('manifest.name is required.');
  if (!version) throw new XsilValidationError('manifest.version is required.');
  if (!semver.valid(version)) {
    throw new XsilValidationError(`manifest.version "${version}" is not valid semver (e.g. 1.0.0).`);
  }
  if (!description) throw new XsilValidationError('manifest.description is required.');
  if (!author) throw new XsilValidationError('manifest.author is required.');
  if (!entry) throw new XsilValidationError('manifest.entry is required.');
}

function assertSafeTarMember(memberPath: string): void {
  const norm = memberPath.replace(/\\/g, '/').replace(/^\.\/+/, '');
  if (norm.startsWith('/') || norm.startsWith('../') || norm.includes('/../')) {
    throw new XsilValidationError('Archive contains an unsafe path entry.');
  }
}

function extractTarGzSystem(archiveAbs: string, destAbs: string): void {
  fs.mkdirSync(destAbs, { recursive: true });
  const r = spawnSync('tar', ['-xzf', archiveAbs, '-C', destAbs], {
    encoding: 'utf-8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.error) {
    throw new XsilValidationError(
      `Could not extract archive (is "tar" installed?). ${r.error.message}`,
    );
  }
  if (r.status !== 0) {
    const msg = (r.stderr || r.stdout || '').trim() || `tar exited with status ${r.status}`;
    throw new XsilValidationError(`Invalid .xsil archive (gzip tar): ${msg}`);
  }
}

export interface ValidatePublishedXsilOptions {
  slug: string;
  formVersion: string;
  /** Optional `checksumArchive` from CLI — must match SHA-256 of the raw bytes. */
  optionalClientArchiveHash?: string;
  /** Optional `checksumPayload` from CLI — must match recomputed payload hash. */
  optionalClientPayloadHash?: string;
}

export interface ValidatePublishedXsilResult {
  /** `sha256:<hex>` for Version.checksumPayload */
  checksumPayloadStored: string;
  manifest: ManifestJson;
}

/**
 * Validates a `.xsil` (gzip-compressed tar) the same way consumers expect: root
 * `manifest.json`, required manifest fields, semver, optional payload hash
 * verification (aligned with `xsil publish` / install), and optional CLI checksum hints.
 */
export function validatePublishedXsilBuffer(
  archiveBuffer: Buffer,
  opts: ValidatePublishedXsilOptions,
): ValidatePublishedXsilResult {
  const archiveHex = crypto.createHash('sha256').update(archiveBuffer).digest('hex');

  if (opts.optionalClientArchiveHash) {
    const want = stripSha256Prefix(opts.optionalClientArchiveHash);
    if (want && want !== archiveHex) {
      throw new XsilValidationError(
        'checksumArchive does not match the uploaded file (re-pack or re-upload).',
      );
    }
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'xsil-publish-'));
  const tarball = path.join(tmpRoot, 'upload.xsil');
  const extractDir = path.join(tmpRoot, 'extract');

  try {
    fs.writeFileSync(tarball, archiveBuffer);
    extractTarGzSystem(tarball, extractDir);

    // Reject path traversal if any entry escaped (defence in depth; tar should already block).
    const walkCheck = (dir: string, rel = ''): void => {
      assertSafeTarMember(rel || '.');
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const nextRel = rel ? `${rel}/${ent.name}` : ent.name;
        assertSafeTarMember(nextRel);
        if (ent.isDirectory()) {
          walkCheck(path.join(dir, ent.name), nextRel);
        }
      }
    };
    walkCheck(extractDir);

    const manifest = readManifest(extractDir);
    validatePublishManifestFields(manifest);

    if (manifest.name!.trim() !== opts.slug) {
      throw new XsilValidationError(
        `manifest.name "${manifest.name!.trim()}" does not match this package (${opts.slug}).`,
      );
    }
    if (manifest.version!.trim() !== opts.formVersion.trim()) {
      throw new XsilValidationError(
        `manifest.version "${manifest.version!.trim()}" must match the submitted version (${opts.formVersion.trim()}).`,
      );
    }

    const computedPayloadHex = computePayloadHashFromDir(extractDir);
    const declared = effectiveDeclaredPayloadHash(manifest);

    if (declared) {
      if (declared !== computedPayloadHex) {
        throw new XsilValidationError(
          'Payload integrity check failed: manifest checksums do not match archive contents. Rebuild the .xsil (e.g. xsil publish --dry-run) and try again.',
        );
      }
    }

    if (opts.optionalClientPayloadHash) {
      const want = stripSha256Prefix(opts.optionalClientPayloadHash);
      if (want && want !== computedPayloadHex) {
        throw new XsilValidationError(
          'checksumPayload does not match the archive (re-pack or fix manifest checksums).',
        );
      }
    }

    return {
      checksumPayloadStored: `sha256:${computedPayloadHex}`,
      manifest,
    };
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}
