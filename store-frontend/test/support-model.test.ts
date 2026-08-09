import { describe, expect, it } from "vitest";
import {
  SUPPORT_GROUPS,
  defaultBackendForTarget,
  legacyPortArtifactDestination,
  supportAnchor,
} from "../lib/support-model";

describe("support model", () => {
  it("places every Target kind in exactly one user-facing group", () => {
    const kinds = SUPPORT_GROUPS.flatMap((group) => group.kinds);
    expect(kinds).toEqual([
      "core",
      "simulator",
      "emulator",
      "toolchain",
      "board",
      "reference",
      "other",
    ]);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it("keeps integration interfaces distinct from core Targets", () => {
    expect(defaultBackendForTarget("cva6")).toEqual({ slug: "cvxif", name: "CV-X-IF" });
    expect(defaultBackendForTarget("rocket")).toEqual({ slug: "rocc", name: "RoCC" });
    expect(supportAnchor("cva6", "cvxif")).toBe("support-cva6-cvxif");
  });

  it("redirects historical Port packages into the canonical Extension matrix", () => {
    expect(legacyPortArtifactDestination("xmac-port-neorv32-cfu")).toEqual({
      extensionSlug: "xmac",
      anchor: "support-neorv32-cfu",
    });
    expect(legacyPortArtifactDestination("xmac")).toBeNull();
  });
});
