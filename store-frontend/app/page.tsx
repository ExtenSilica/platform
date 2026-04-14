import { Suspense } from "react";
import { HomeIndex } from "@/components/home-index";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="container max-w-6xl px-4 py-16 text-muted-foreground">
          Loading…
        </div>
      }
    >
      <HomeIndex />
    </Suspense>
  );
}
