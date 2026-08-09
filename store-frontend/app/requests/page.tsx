import { Suspense } from "react";
import type { Metadata } from "next";
import { ImplementationRequestsList } from "@/components/implementation-requests-list";

export const metadata: Metadata = {
  title: "Port requests",
  description:
    "Browse open work to port RISC-V Extensions to concrete Targets with reproducible evidence.",
};

export default function RequestsPage() {
  return (
    <Suspense
      fallback={
        <div className="container max-w-4xl px-4 py-10 text-muted-foreground">
          Loading requests…
        </div>
      }
    >
      <ImplementationRequestsList />
    </Suspense>
  );
}
