import { Suspense } from "react";
import type { Metadata } from "next";
import { ImplementationRequestDetail } from "@/components/implementation-request-detail";

export const metadata: Metadata = {
  title: "Implementation request",
};

export default function ImplementationRequestPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <Suspense
      fallback={
        <div className="container max-w-3xl px-4 py-10 text-muted-foreground">
          Loading request…
        </div>
      }
    >
      <ImplementationRequestDetail id={params.id} />
    </Suspense>
  );
}
