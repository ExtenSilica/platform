"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { RegistryPackage } from "@/lib/types";
import { fetchPackages } from "@/lib/api";
import { PackageCard } from "@/components/package-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Search, RefreshCcw, WifiOff } from "lucide-react";

function CardSkeleton() {
  return <div className="h-44 animate-pulse rounded-lg border bg-muted/40" />;
}

export function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const query = searchParams.get("q") ?? "";

  const [packages, setPackages] = useState<RegistryPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await fetchPackages(query || undefined);
      setPackages(data);
    } catch (err) {
      console.error(err);
      setError("Could not reach the registry. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = inputRef.current?.value.trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    router.replace(`/search?${params.toString()}`);
  }

  return (
    <div className="container max-w-6xl px-4 py-10">
      {/* Heading */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {query ? (
            <>
              Results for{" "}
              <span className="text-primary">&ldquo;{query}&rdquo;</span>
            </>
          ) : (
            "All packages"
          )}
        </h1>
        {!loading && !error && (
          <p className="text-sm text-muted-foreground">
            {packages.length} package{packages.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Results */}
      {error ? (
        <Alert variant="destructive" className="max-w-xl">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>Connection error</AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p>{error}</p>
            <Button variant="secondary" size="sm" onClick={load} className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 py-20 text-center">
          <p className="font-medium text-foreground">No packages found</p>
          {query ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Try a different search term, or{" "}
              <button
                type="button"
                onClick={() => router.replace("/search")}
                className="underline hover:text-foreground"
              >
                browse all packages
              </button>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No packages have been published yet.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      )}
    </div>
  );
}
