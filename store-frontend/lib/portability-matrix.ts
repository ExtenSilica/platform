/**
 * Portability matrix derived from `manifest.targets` JSON (stored on Version.targets).
 *
 * A package opts in when at least one target object carries matrix fields
 * (`preBuild`, `postTest`, `adapter`, `build`, `tests`, or `portPackage`).
 *
 * Never displays "Compatible" from capability flags — that word is reserved for
 * post-test human claims and is sanitized away if a publisher puts it in preBuild.
 */

export type PortabilityCellTone =
  | "neutral"
  | "muted"
  | "info"
  | "warn"
  | "success"
  | "danger";

export interface PortabilityMatrixRow {
  target: string;
  preBuild: string;
  adapter: string;
  build: string;
  tests: string;
  /** Post-test status when present (shown via Tests column / title). */
  postTest: string | null;
  portPackage: string | null;
  notes: string | null;
}

export interface PortabilityMatrix {
  rows: PortabilityMatrixRow[];
}

const MATRIX_KEYS = new Set([
  "preBuild",
  "pre_build",
  "postTest",
  "post_test",
  "adapter",
  "build",
  "tests",
  "portPackage",
  "port_package",
]);

const FORBIDDEN_COMPATIBLE = /^compatible$/i;

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function dash(v: string | null | undefined): string {
  return v && v.trim() ? v.trim() : "—";
}

/** Reject flag-only "Compatible" claims in pre-build cells. */
export function sanitizePreBuild(raw: string | null | undefined): string {
  const s = dash(raw);
  if (FORBIDDEN_COMPATIBLE.test(s)) return "Looks mappable";
  return s;
}

export function sanitizePostTest(raw: string | null | undefined): string | null {
  const s = str(raw);
  if (!s) return null;
  if (FORBIDDEN_COMPATIBLE.test(s)) return "Differentially validated";
  // Normalize common enum forms from evidence JSON.
  if (s === "DIFFERENTIALLY_VALIDATED") return "Differentially validated";
  if (s === "VERIFIED_ON_TARGET") return "Verified on target";
  return s;
}

function isMatrixShaped(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).some((k) => MATRIX_KEYS.has(k));
}

function rowFromTarget(
  target: string,
  obj: Record<string, unknown>
): PortabilityMatrixRow {
  const status = str(obj.status);
  const preBuild =
    str(obj.preBuild) ??
    str(obj.pre_build) ??
    (status === "not_assessed" ? "Not assessed" : null);
  const postTest = sanitizePostTest(
    str(obj.postTest) ?? str(obj.post_test) ?? null
  );
  const testsRaw = str(obj.tests);
  const tests =
    testsRaw ??
    (postTest && postTest !== "—" ? postTest : null) ??
    (status === "not_assessed" ? "—" : null);

  let adapter =
    str(obj.adapter) ??
    (status === "not_assessed" ? "—" : null);
  if (!adapter) {
    const pre = sanitizePreBuild(preBuild);
    if (pre === "Adapter required") adapter = "Required";
    else if (pre === "Looks mappable" || pre === "Candidate") adapter = "Native";
    else adapter = "—";
  }

  return {
    target,
    preBuild: sanitizePreBuild(preBuild),
    adapter: dash(adapter),
    build: dash(str(obj.build)),
    tests: dash(tests),
    postTest,
    portPackage: str(obj.portPackage) ?? str(obj.port_package),
    notes: str(obj.notes),
  };
}

/**
 * Parse Version.targets JSON into a portability matrix, or null if the package
 * does not declare matrix fields (ordinary Spike/QEMU targets stay untouched).
 */
export function parsePortabilityMatrix(
  raw: string | null | undefined
): PortabilityMatrix | null {
  if (!raw?.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const entries = Object.entries(parsed as Record<string, unknown>);
  const shaped = entries.filter(
    ([, v]) => v && typeof v === "object" && !Array.isArray(v) && isMatrixShaped(v as Record<string, unknown>)
  );
  if (shaped.length === 0) {
    // Also accept packages that only list not_assessed / working with portPackage
    // via status-only rows when ANY sibling has matrix keys — already handled.
    // Status-only "not_assessed" without matrix keys: treat whole map as matrix
    // only if every value is an object with status in the portability vocabulary.
    const allStatusOnly = entries.every(([, v]) => {
      if (!v || typeof v !== "object" || Array.isArray(v)) return false;
      const o = v as Record<string, unknown>;
      const st = str(o.status);
      return (
        st === "not_assessed" ||
        st === "working" ||
        st === "candidate"
      ) && !("isa" in o) && !("config" in o) && !("binary" in o);
    });
    if (!allStatusOnly || entries.length === 0) return null;
    return {
      rows: entries.map(([k, v]) =>
        rowFromTarget(k, v as Record<string, unknown>)
      ),
    };
  }

  // Include sibling status-only rows (e.g. cva6-cvxif: not_assessed) when matrix present.
  return {
    rows: entries
      .filter(([, v]) => v && typeof v === "object" && !Array.isArray(v))
      .map(([k, v]) => rowFromTarget(k, v as Record<string, unknown>)),
  };
}

export function preBuildTone(label: string): PortabilityCellTone {
  const s = label.toLowerCase();
  if (s.includes("unsupported")) return "danger";
  if (s.includes("adapter required")) return "warn";
  if (s.includes("not assessed")) return "muted";
  if (s.includes("candidate")) return "info";
  if (s.includes("looks mappable")) return "info";
  return "neutral";
}

export function testsTone(label: string, postTest: string | null): PortabilityCellTone {
  const blob = `${label} ${postTest ?? ""}`.toLowerCase();
  if (blob.includes("fail") || blob.includes("unsupported")) return "danger";
  if (
    blob.includes("differentially validated") ||
    blob.includes("verified on target")
  ) {
    return "success";
  }
  if (/^\d+\/\d+$/.test(label.trim())) return "success";
  if (label === "—" || blob.includes("not assessed")) return "muted";
  return "neutral";
}

export const PORTABILITY_MATRIX_NOTE =
  "Pre-build is capability flags only — never “Compatible”. Post-test status is earned by shared differential tests.";
