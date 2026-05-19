import { describe, it, expect } from "vitest";
import {
  buildSearchPageTitle,
  parseSearchParams,
  searchParamsCacheKey,
  toListPackagesQuery,
} from "../lib/search-params";

describe("parseSearchParams", () => {
  it("parses query and filters from URLSearchParams", () => {
    const sp = new URLSearchParams(
      "q=vector&author=acme&standardStatus=ratified,vendor&sort=downloads&order=asc",
    );
    const parsed = parseSearchParams(sp);
    expect(parsed.query).toBe("vector");
    expect(parsed.author).toBe("acme");
    expect(parsed.activeStatuses).toEqual(["ratified", "vendor"]);
    expect(parsed.sort).toBe("downloads");
    expect(parsed.order).toBe("asc");
  });

  it("builds stable cache keys", () => {
    const a = searchParamsCacheKey(
      parseSearchParams(new URLSearchParams("q=rvv")),
    );
    const b = searchParamsCacheKey(
      parseSearchParams({ q: "rvv" }),
    );
    expect(a).toBe(b);
  });

  it("maps to list packages query", () => {
    const q = toListPackagesQuery(
      parseSearchParams(new URLSearchParams("q=zbkb&portStatus=seeded")),
    );
    expect(q.q).toBe("zbkb");
    expect(q.portStatus).toEqual(["seeded"]);
  });

  it("builds metadata title with query", () => {
    expect(
      buildSearchPageTitle(parseSearchParams(new URLSearchParams("q=rvv"))),
    ).toContain("rvv");
  });
});
