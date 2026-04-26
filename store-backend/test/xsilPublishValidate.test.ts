import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it, expect } from "vitest";

import {
  computePayloadHashFromDir,
  validateAndStringifyManifestEvidence,
  validatePublishedXsilBuffer,
  XsilValidationError,
} from "../src/lib/xsilPublishValidate";

/** Copy of `examples/rvx-demo` kept for backend tests (public repo: ExtenSilica/xsil). */
const rvxDemoDir = path.join(__dirname, "fixtures/rvx-demo");

function packDirToBuffer(dir: string): Buffer {
  const out = path.join(os.tmpdir(), `xsil-test-${process.pid}-${Math.random().toString(16).slice(2)}.xsil`);
  execFileSync("tar", ["-czf", out, "-C", dir, "."], { stdio: "pipe" });
  const buf = fs.readFileSync(out);
  fs.unlinkSync(out);
  return buf;
}

describe("xsilPublishValidate", () => {
  it("computePayloadHashFromDir matches rvx-demo manifest checksums.payload", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(rvxDemoDir, "manifest.json"), "utf8"),
    ) as { checksums?: { payload?: string } };
    const declared = manifest.checksums?.payload?.replace(/^sha256:/i, "").trim();
    expect(declared).toBeTruthy();
    const computed = computePayloadHashFromDir(rvxDemoDir);
    expect(computed).toBe(declared);
  });

  it("validatePublishedXsilBuffer accepts a packed rvx-demo archive", () => {
    const buf = packDirToBuffer(rvxDemoDir);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(rvxDemoDir, "manifest.json"), "utf8"),
    ) as { name: string; version: string };

    const r = validatePublishedXsilBuffer(buf, {
      slug: manifest.name,
      formVersion: manifest.version,
    });
    expect(r.checksumPayloadStored.startsWith("sha256:")).toBe(true);
    expect(r.evidenceJson).toBeNull();
  });

  it("validateAndStringifyManifestEvidence accepts a minimal https row", () => {
    const j = validateAndStringifyManifestEvidence([
      { kind: "documentation", url: "https://example.com/README", label: "Docs" },
    ]);
    expect(j).toContain("documentation");
    expect(j).toContain("https://example.com/README");
  });

  it("validateAndStringifyManifestEvidence rejects non-https URL", () => {
    expect(() =>
      validateAndStringifyManifestEvidence([{ kind: "ci", url: "http://example.com/x" }]),
    ).toThrow(XsilValidationError);
  });

  it("rejects slug / manifest.name mismatch", () => {
    const buf = packDirToBuffer(rvxDemoDir);
    expect(() =>
      validatePublishedXsilBuffer(buf, {
        slug: "wrong-slug",
        formVersion: "1.0.0",
      }),
    ).toThrow(XsilValidationError);
  });

  it("rejects version mismatch between form and manifest", () => {
    const buf = packDirToBuffer(rvxDemoDir);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(rvxDemoDir, "manifest.json"), "utf8"),
    ) as { name: string };

    expect(() =>
      validatePublishedXsilBuffer(buf, {
        slug: manifest.name,
        formVersion: "9.9.9",
      }),
    ).toThrow(XsilValidationError);
  });

  it("rejects invalid gzip", () => {
    const buf = Buffer.from("not a tarball");
    expect(() =>
      validatePublishedXsilBuffer(buf, {
        slug: "x",
        formVersion: "1.0.0",
      }),
    ).toThrow(XsilValidationError);
  });
});
