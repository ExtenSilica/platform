"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import type {
  CollisionGraph,
  CollisionGraphEdge,
  CollisionGraphNode,
  ExtensionConflictSeverity,
  ExtensionConflictType,
} from "@/lib/types";

type SimNode = SimulationNodeDatum & CollisionGraphNode;
type SimEdge = SimulationLinkDatum<SimNode> & {
  edgeType: ExtensionConflictType;
  severity: ExtensionConflictSeverity;
  detail: string;
};

type Filters = Record<`${ExtensionConflictType}:${ExtensionConflictSeverity}`, boolean>;

const DEFAULT_FILTERS: Filters = {
  "OPCODE:FATAL": true,
  "OPCODE:WARNING": true,
  "OPCODE_SHARED:WARNING": true,
  "OPCODE_SHARED:FATAL": true, // backend never emits this, keep for type completeness
  "CSR:FATAL": true,
  "CSR:WARNING": true,
  "CUSTOM_SPACE:FATAL": true,
  "CUSTOM_SPACE:WARNING": false, // 60+ edges, off by default to keep canvas readable
};

const EDGE_STYLES: Record<
  string,
  { stroke: string; label: string; description: string }
> = {
  "OPCODE:FATAL": {
    stroke: "rgb(239 68 68)", // red-500
    label: "Opcode FATAL",
    description: "Same encoding tuple, different mnemonics — real hardware conflict.",
  },
  "OPCODE:WARNING": {
    stroke: "rgb(234 179 8)", // yellow-500
    label: "Opcode WARNING",
    description: "Opcode conflict but at least one side is remappable.",
  },
  "OPCODE_SHARED:WARNING": {
    stroke: "rgb(34 211 238)", // cyan-400
    label: "Shared instruction",
    description:
      "Same encoding + same mnemonic = same instruction by spec (designed overlap, e.g. Zbkb ⊂ Zbb).",
  },
  "OPCODE_SHARED:FATAL": {
    stroke: "rgb(34 211 238)",
    label: "Shared instruction (FATAL?)",
    description: "Unusual — shared mnemonic flagged FATAL.",
  },
  "CSR:FATAL": {
    stroke: "rgb(168 85 247)", // purple-500
    label: "CSR FATAL",
    description: "Overlapping CSR addresses on non-remappable extensions.",
  },
  "CSR:WARNING": {
    stroke: "rgb(192 132 252)", // purple-400
    label: "CSR WARNING",
    description: "Overlapping CSR addresses; remappable.",
  },
  "CUSTOM_SPACE:FATAL": {
    stroke: "rgb(120 113 108)", // stone-500
    label: "Custom-space FATAL",
    description: "Both claim the same custom-N major opcode space.",
  },
  "CUSTOM_SPACE:WARNING": {
    stroke: "rgb(168 162 158)", // stone-400
    label: "Custom-space WARNING",
    description:
      "Both reach for the same custom-N opcode space. Common in open vendor catalogs.",
  },
};

function rlColor(rl: number | null): string {
  switch (rl) {
    case 5:
      return "rgb(34 197 94)"; // green-500
    case 4:
      return "rgb(132 204 22)"; // lime-500
    case 3:
      return "rgb(234 179 8)"; // yellow-500
    case 2:
      return "rgb(249 115 22)"; // orange-500
    case 1:
    default:
      return "rgb(120 113 108)"; // stone-500
  }
}

function edgeKey(e: { type: ExtensionConflictType; severity: ExtensionConflictSeverity }): keyof Filters {
  return `${e.type}:${e.severity}` as keyof Filters;
}

export function CompatibilityGraph({ graph }: { graph: CollisionGraph }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<Simulation<SimNode, SimEdge> | null>(null);

  const [size, setSize] = useState({ width: 1000, height: 700 });
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState("");
  const [hoveredEdge, setHoveredEdge] = useState<SimEdge | null>(null);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [tick, setTick] = useState(0);

  // Filtered edges from the props.
  const visibleEdges = useMemo<SimEdge[]>(
    () =>
      graph.edges
        .filter((e) => filters[edgeKey(e)])
        .map((e) => ({
          source: e.source,
          target: e.target,
          edgeType: e.type,
          severity: e.severity,
          detail: e.detail,
        })),
    [graph.edges, filters],
  );

  // Stable nodes list (one SimNode per CollisionGraphNode).
  const nodes = useMemo<SimNode[]>(
    () => graph.nodes.map((n) => ({ ...n })),
    [graph.nodes],
  );

  // Boot the simulation once; restart with `alpha(0.6)` when filters change so
  // the layout reshuffles around the visible subgraph.
  useEffect(() => {
    if (!size.width) return;

    const sim = forceSimulation<SimNode>(nodes)
      .force(
        "link",
        forceLink<SimNode, SimEdge>(visibleEdges)
          .id((d) => d.id)
          .distance(80)
          .strength(0.7),
      )
      .force("charge", forceManyBody<SimNode>().strength(-260))
      .force("center", forceCenter(size.width / 2, size.height / 2))
      .force("collide", forceCollide<SimNode>().radius(22))
      .on("tick", () => setTick((t) => (t + 1) % 1_000_000));

    simRef.current = sim;
    return () => {
      sim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, visibleEdges, size.width, size.height]);

  // Responsive canvas sizing.
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      const { width } = el.getBoundingClientRect();
      const w = Math.max(400, Math.floor(width));
      const h = Math.max(500, Math.min(800, Math.floor(w * 0.7)));
      setSize({ width: w, height: h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const highlightedIds = useMemo(() => {
    if (!query.trim()) return null;
    const needle = query.trim().toLowerCase();
    return new Set(
      nodes
        .filter(
          (n) =>
            n.slug.toLowerCase().includes(needle) ||
            n.name.toLowerCase().includes(needle),
        )
        .map((n) => n.id),
    );
  }, [nodes, query]);

  const visibleEdgeKeys = useMemo(() => {
    const k = new Set<string>();
    for (const e of visibleEdges) {
      k.add(`${e.edgeType}:${e.severity}`);
    }
    return k;
  }, [visibleEdges]);

  const connectedNodeIds = useMemo(() => {
    const s = new Set<string>();
    for (const e of visibleEdges) {
      const src = typeof e.source === "object" ? (e.source as SimNode).id : String(e.source);
      const tgt = typeof e.target === "object" ? (e.target as SimNode).id : String(e.target);
      s.add(src);
      s.add(tgt);
    }
    return s;
  }, [visibleEdges]);

  // Force a re-render on each simulation tick.
  void tick;

  return (
    <div className="space-y-4">
      {/* Filter chips + search */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-3">
        <input
          type="search"
          placeholder="Filter nodes (slug or name)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full min-w-0 max-w-xs rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-auto"
        />
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(EDGE_STYLES)
            .filter(([k]) => graph.stats.byTypeSeverity[k] !== undefined)
            .map(([k, style]) => {
              const active = filters[k as keyof Filters];
              const count = graph.stats.byTypeSeverity[k] ?? 0;
              return (
                <button
                  key={k}
                  onClick={() =>
                    setFilters((f) => ({ ...f, [k]: !f[k as keyof Filters] }))
                  }
                  className={
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition " +
                    (active
                      ? "bg-background"
                      : "bg-muted text-muted-foreground opacity-60")
                  }
                  aria-pressed={active}
                  title={style.description}
                >
                  <span
                    className="inline-block h-2 w-3 rounded-sm"
                    style={{ background: style.stroke }}
                    aria-hidden
                  />
                  <span className="font-medium">{style.label}</span>
                  <span className="tabular-nums">{count}</span>
                </button>
              );
            })}
        </div>
      </div>

      {/* The graph itself */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-lg border bg-background"
      >
        <svg
          ref={svgRef}
          width={size.width}
          height={size.height}
          role="img"
          aria-label="Extension collision graph"
        >
          <defs>
            <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="white" stopOpacity={0.35} />
              <stop offset="100%" stopColor="white" stopOpacity={0} />
            </radialGradient>
          </defs>

          {/* edges */}
          <g>
            {visibleEdges.map((e, i) => {
              const src = e.source as SimNode;
              const tgt = e.target as SimNode;
              if (
                typeof src !== "object" ||
                typeof tgt !== "object" ||
                src.x == null ||
                src.y == null ||
                tgt.x == null ||
                tgt.y == null
              )
                return null;
              const key = `${e.edgeType}:${e.severity}` as keyof Filters;
              const style = EDGE_STYLES[key];
              const dim =
                highlightedIds &&
                !highlightedIds.has(src.id) &&
                !highlightedIds.has(tgt.id);
              const isHovered = hoveredEdge === e;
              return (
                <line
                  key={i}
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  stroke={style?.stroke ?? "currentColor"}
                  strokeWidth={isHovered ? 2.6 : 1.4}
                  strokeOpacity={dim ? 0.1 : isHovered ? 1 : 0.6}
                  onMouseEnter={() => setHoveredEdge(e)}
                  onMouseLeave={() => setHoveredEdge(null)}
                  style={{ cursor: "pointer" }}
                />
              );
            })}
          </g>

          {/* nodes */}
          <g>
            {nodes.map((n) => {
              if (n.x == null || n.y == null) return null;
              const dimByQuery = highlightedIds && !highlightedIds.has(n.id);
              const dimByDisconnect = !connectedNodeIds.has(n.id);
              const isolated = dimByDisconnect && !connectedNodeIds.has(n.id);
              const opacity = dimByQuery ? 0.18 : isolated ? 0.5 : 1;
              const r = hoveredNode === n ? 11 : 8;
              return (
                <Link
                  key={n.id}
                  href={`/package/${encodeURIComponent(n.slug)}`}
                  aria-label={`${n.name} — open package`}
                >
                  <g
                    transform={`translate(${n.x},${n.y})`}
                    onMouseEnter={() => setHoveredNode(n)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ cursor: "pointer" }}
                    opacity={opacity}
                  >
                    <circle r={r + 5} fill="url(#node-glow)" />
                    <circle
                      r={r}
                      fill={rlColor(n.rl)}
                      stroke="rgba(0,0,0,0.4)"
                      strokeWidth={0.8}
                    />
                    {hoveredNode === n && (
                      <text
                        x={r + 6}
                        y={4}
                        fontSize={12}
                        fill="currentColor"
                        style={{ pointerEvents: "none", userSelect: "none" }}
                      >
                        {n.slug}
                      </text>
                    )}
                  </g>
                </Link>
              );
            })}
          </g>
        </svg>

        {/* tooltip */}
        {(hoveredEdge || hoveredNode) && (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 max-w-2xl rounded-md border bg-background/95 px-3 py-2 text-sm shadow-md backdrop-blur">
            {hoveredEdge ? (
              <div>
                <div className="font-semibold">
                  {EDGE_STYLES[edgeKey(hoveredEdge as unknown as CollisionGraphEdge)]?.label}
                </div>
                <div className="text-muted-foreground">{hoveredEdge.detail}</div>
              </div>
            ) : hoveredNode ? (
              <div>
                <div className="font-semibold">{hoveredNode.name}</div>
                <div className="text-xs text-muted-foreground">
                  {hoveredNode.standardStatus ?? "—"} · RL{hoveredNode.rl ?? "?"} ·{" "}
                  {hoveredNode.portStatus ?? "—"} ·{" "}
                  {hoveredNode.version ?? "no version"}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
        <div className="mb-2 font-semibold text-foreground">Reading the graph</div>
        <ul className="space-y-1">
          <li>
            <strong className="text-foreground">Nodes</strong> = published
            extensions. Color = Readiness Level (RL5 green → RL1 stone).
          </li>
          <li>
            <strong className="text-foreground">Edges</strong> = collisions
            detected by the registry. Click a node to open its package page.
          </li>
          <li>
            <strong style={{ color: "rgb(34 211 238)" }}>Cyan</strong> edges
            (SHARED) are <em>designed overlaps</em>, not real conflicts — e.g.
            Zbkb&apos;s <code>rol</code> and Zbb&apos;s <code>rol</code> are the
            same instruction by spec.
          </li>
          <li>
            Hidden by default:{" "}
            <strong>{visibleEdgeKeys.size < Object.keys(EDGE_STYLES).length
              ? "CUSTOM_SPACE WARNING"
              : "—"}</strong>{" "}
            (toggle on above to show vendor custom-space overlaps).
          </li>
        </ul>
      </div>
    </div>
  );
}
