import type { Metadata } from "next";
import { fetchPackages } from "@/lib/api";
import { SearchResults } from "@/components/search-results";
import {
  buildSearchPageDescription,
  buildSearchPageTitle,
  parseSearchParams,
  searchParamsCacheKey,
  toListPackagesQuery,
} from "@/lib/search-params";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export function generateMetadata({ searchParams }: SearchPageProps): Metadata {
  const parsed = parseSearchParams(searchParams);
  return {
    title: buildSearchPageTitle(parsed),
    description: buildSearchPageDescription(parsed),
    openGraph: {
      title: buildSearchPageTitle(parsed),
      description: buildSearchPageDescription(parsed),
    },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const parsed = parseSearchParams(searchParams);
  const initialSearchKey = searchParamsCacheKey(parsed);

  let initialPackages: Awaited<ReturnType<typeof fetchPackages>> = [];
  let initialError: string | null = null;

  try {
    initialPackages = await fetchPackages(toListPackagesQuery(parsed));
  } catch (err) {
    console.error("[search/page]", err);
    initialError = "Could not reach the registry. Is the backend running?";
  }

  return (
    <SearchResults
      initialPackages={initialPackages}
      initialError={initialError}
      initialSearchKey={initialSearchKey}
      initialParsed={parsed}
    />
  );
}
