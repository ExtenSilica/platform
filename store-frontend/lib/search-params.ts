import type { ListPackagesQuery } from "@/lib/api";
import {
  PORT_STATUS_VALUES,
  STANDARD_STATUS_VALUES,
  type PortStatus,
  type StandardStatus,
} from "@/lib/types";

export type ParsedSearchParams = {
  query: string;
  author: string;
  org: string;
  level: string;
  activeStatuses: StandardStatus[];
  activePortStatuses: PortStatus[];
  sort: "created" | "downloads";
  order: "asc" | "desc";
};

function getParam(
  source: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
): string {
  if (source instanceof URLSearchParams) {
    return source.get(key) ?? "";
  }
  const raw = source[key];
  if (Array.isArray(raw)) return raw[0] ?? "";
  return raw ?? "";
}

export function parseStatuses(raw: string): StandardStatus[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is StandardStatus =>
      (STANDARD_STATUS_VALUES as string[]).includes(s),
    );
}

export function parsePortStatuses(raw: string): PortStatus[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/-/g, "_"))
    .filter((s): s is PortStatus =>
      (PORT_STATUS_VALUES as string[]).includes(s),
    );
}

export function parseSearchParams(
  source: URLSearchParams | Record<string, string | string[] | undefined>,
): ParsedSearchParams {
  const sortRaw = getParam(source, "sort");
  const orderRaw = getParam(source, "order");

  return {
    query: getParam(source, "q"),
    author: getParam(source, "author"),
    org: getParam(source, "org"),
    level: getParam(source, "level"),
    activeStatuses: parseStatuses(getParam(source, "standardStatus")),
    activePortStatuses: parsePortStatuses(getParam(source, "portStatus")),
    sort: sortRaw === "downloads" ? "downloads" : "created",
    order: orderRaw === "asc" ? "asc" : "desc",
  };
}

export function toListPackagesQuery(parsed: ParsedSearchParams): ListPackagesQuery {
  return {
    q: parsed.query || undefined,
    author: parsed.author || undefined,
    org: parsed.org || undefined,
    level: parsed.level || undefined,
    standardStatus: parsed.activeStatuses.length ? parsed.activeStatuses : undefined,
    portStatus: parsed.activePortStatuses.length ? parsed.activePortStatuses : undefined,
    sort: parsed.sort,
    order: parsed.order,
  };
}

export function searchParamsCacheKey(parsed: ParsedSearchParams): string {
  return [
    parsed.query,
    parsed.author,
    parsed.org,
    parsed.level,
    parsed.activeStatuses.join(","),
    parsed.activePortStatuses.join(","),
    parsed.sort,
    parsed.order,
  ].join("|");
}

export function hasStructuredFilters(parsed: ParsedSearchParams): boolean {
  return Boolean(
    parsed.author ||
      parsed.org ||
      parsed.level ||
      parsed.activeStatuses.length ||
      parsed.activePortStatuses.length,
  );
}

export function buildSearchPageTitle(parsed: ParsedSearchParams): string {
  if (parsed.query) {
    return `Search: ${parsed.query} — ExtenSilica`;
  }
  if (hasStructuredFilters(parsed)) {
    return "Filtered Extensions — ExtenSilica";
  }
  return "Browse RISC-V Extensions — ExtenSilica";
}

export function buildSearchPageDescription(parsed: ParsedSearchParams): string {
  if (parsed.query) {
    return `Search results for “${parsed.query}” on the ExtenSilica registry of versioned RISC-V extension packages.`;
  }
  return "Browse versioned RISC-V extension packages, specifications, encodings, provenance, and optional engineering artifacts.";
}
