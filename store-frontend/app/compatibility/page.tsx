import type { Metadata } from "next";
import Link from "next/link";
import { CompatibilityGraph } from "@/components/compatibility-graph";
import { fetchCollisionGraph } from "@/lib/api";

export const metadata: Metadata = {
  title: "Compatibility graph — ExtenSilica",
  description:
    "Interactive map of encoding overlaps and conflicts between every RISC-V extension published on the ExtenSilica registry.",
};

export const dynamic = "force-dynamic";

function fmtNum(n: number) {
  return n.toLocaleString();
}

export default async function CompatibilityPage() {
  let graph: Awaited<ReturnType<typeof fetchCollisionGraph>> | null = null;
  let error: string | null = null;
  try {
    graph = await fetchCollisionGraph();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load collision graph.";
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Compatibility graph</h1>
        <p className="text-muted-foreground">
          Every node is a published RISC-V extension. Every edge is an encoding
          relation the registry detected between two extensions —
          <span className="px-1 font-mono">FATAL</span> conflicts (full encoding
          tuple matches with different mnemonics),
          <span className="px-1 font-mono">WARNING</span> conflicts (remappable),
          designed
          <span className="px-1 font-mono">SHARED</span> overlaps (same
          instruction by spec),
          <span className="px-1 font-mono">SHARED MAJOR OPCODE</span>{" "}
          (informational; both live under the same 7-bit major opcode), and
          overlapping
          <span className="px-1 font-mono">CUSTOM</span> opcode spaces.
        </p>
      </header>

      {/*
        Early-life honesty note: the catalog-seed pass that imported most of the
        ratified RISC-V extensions could not extract funct3/funct6/funct7 from
        the upstream specs for several encoding classes (notably RVV vector
        instructions, which use funct6 + vm fields the seed parser didn't know
        about). Those rows landed with all sub-fields null, and the old detector
        flagged any major-opcode match as FATAL — see the brucehoult thread on
        r/RISCV from June 2026. The detector now classifies those as
        "shared major opcode" (informational), but the underlying instruction
        rows still need re-import with proper funct3/funct6 to surface real
        sub-opcode conflicts (or designed overlaps) inside each shared space.
      */}
      <aside className="rounded-lg border border-blue-400/30 bg-blue-400/5 p-4 text-sm">
        <p className="font-semibold text-foreground">
          Reading shared major opcodes correctly
        </p>
        <p className="mt-1 text-muted-foreground">
          Many ratified extensions live under the same 7-bit major opcode by
          design — RVV vector instructions all sit at{" "}
          <span className="font-mono">OP-V 0x57</span>, atomics at{" "}
          <span className="font-mono">AMO 0x2F</span>, immediate ops at{" "}
          <span className="font-mono">OP-IMM 0x13</span>. They are NOT
          conflicts: they&apos;re disambiguated at the next decode level
          (funct3 + funct6/funct7, register and immediate fields). Such edges
          are now classified as{" "}
          <span className="font-mono">SHARED_MAJOR_OPCODE</span> and rendered in
          blue. Real conflicts require a full encoding-mask match — flagged{" "}
          <span className="font-mono">FATAL</span> in red.
        </p>
      </aside>

      {error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm">
          <p className="font-semibold">Could not load the graph.</p>
          <p className="text-muted-foreground">{error}</p>
        </div>
      ) : graph ? (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Extensions" value={fmtNum(graph.stats.nodeCount)} />
            <StatCard label="Edges" value={fmtNum(graph.stats.edgeCount)} />
            <StatCard
              label="FATAL conflicts"
              value={fmtNum(graph.stats.byTypeSeverity["OPCODE:FATAL"] ?? 0)}
            />
            <StatCard
              label="Designed overlaps"
              value={fmtNum(
                graph.stats.byTypeSeverity["OPCODE_SHARED:WARNING"] ?? 0,
              )}
            />
          </section>

          <CompatibilityGraph graph={graph} />

          <footer className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
            <p>
              Computed by the registry collision detector against the current
              instruction encodings of every published extension. Updated every
              5 minutes. Want the raw data?{" "}
              <Link
                className="underline"
                href={
                  (process.env.NEXT_PUBLIC_API_URL ??
                    "http://localhost:3001/api") +
                  "/graph/collisions"
                }
              >
                JSON endpoint
              </Link>
              . Last computed at{" "}
              <time dateTime={graph.generatedAt} className="tabular-nums">
                {new Date(graph.generatedAt).toLocaleString()}
              </time>
              .
            </p>
          </footer>
        </>
      ) : null}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-5">
      <p className="text-3xl font-extrabold tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
