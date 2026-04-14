import { Suspense } from "react";
import { SearchResults } from "@/components/search-results";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search packages — ExtenSilica",
};

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="container max-w-6xl px-4 py-10 text-muted-foreground">
          Loading…
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  );
}
