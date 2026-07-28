import { describe, it, expect } from "vitest";
import {
  parsePortabilityMatrix,
  sanitizePreBuild,
  sanitizePostTest,
} from "../lib/portability-matrix";

describe("sanitizePreBuild", () => {
  it("never lets Compatible through from flags", () => {
    expect(sanitizePreBuild("Compatible")).toBe("Looks mappable");
    expect(sanitizePreBuild("compatible")).toBe("Looks mappable");
  });

  it("keeps honest vocabulary", () => {
    expect(sanitizePreBuild("Adapter required")).toBe("Adapter required");
    expect(sanitizePreBuild("Not assessed")).toBe("Not assessed");
  });
});

describe("sanitizePostTest", () => {
  it("normalizes evidence enums", () => {
    expect(sanitizePostTest("DIFFERENTIALLY_VALIDATED")).toBe(
      "Differentially validated"
    );
  });

  it("rejects Compatible as a post-test label", () => {
    expect(sanitizePostTest("Compatible")).toBe("Differentially validated");
  });
});

describe("parsePortabilityMatrix", () => {
  it("returns null for ordinary Spike/QEMU targets", () => {
    const raw = JSON.stringify({
      spike: { isa: "rv64gc", config: "sim/spike.yaml", status: "working" },
      qemu: { binary: "qemu-riscv64-static" },
    });
    expect(parsePortabilityMatrix(raw)).toBeNull();
  });

  it("parses xmac-shaped matrix rows", () => {
    const raw = JSON.stringify({
      reference: {
        status: "working",
        preBuild: "Looks mappable",
        adapter: "Native",
        build: "—",
        tests: "1200/1200",
        postTest: "Differentially validated",
      },
      "picorv32-pcpi": {
        status: "working",
        preBuild: "Adapter required",
        adapter: "Generated (pcpi_rsd)",
        build: "Passed",
        tests: "1500/1500",
        postTest: "Differentially validated",
        portPackage: "xmac-port-picorv32-pcpi",
      },
      "cva6-cvxif": { status: "not_assessed" },
    });
    const matrix = parsePortabilityMatrix(raw);
    expect(matrix).not.toBeNull();
    expect(matrix!.rows).toHaveLength(3);
    const pcpi = matrix!.rows.find((r) => r.target === "picorv32-pcpi")!;
    expect(pcpi.preBuild).toBe("Adapter required");
    expect(pcpi.portPackage).toBe("xmac-port-picorv32-pcpi");
    expect(pcpi.tests).toBe("1500/1500");
    const cva6 = matrix!.rows.find((r) => r.target === "cva6-cvxif")!;
    expect(cva6.preBuild).toBe("Not assessed");
    expect(cva6.tests).toBe("—");
  });

  it("sanitizes Compatible in publisher-supplied preBuild", () => {
    const raw = JSON.stringify({
      foo: { preBuild: "Compatible", tests: "—" },
    });
    const matrix = parsePortabilityMatrix(raw)!;
    expect(matrix.rows[0].preBuild).toBe("Looks mappable");
  });
});
