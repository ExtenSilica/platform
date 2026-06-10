"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import { drag as d3drag, type D3DragEvent } from "d3-drag";
import { select } from "d3-selection";
import {
  zoom as d3zoom,
  zoomIdentity,
  type D3ZoomEvent,
  type ZoomBehavior,
} from "d3-zoom";
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

type FilterKey = `${ExtensionConflictType}:${ExtensionConflictSeverity}`;
type Filters = Record<FilterKey, boolean>;

const DEFAULT_FILTERS: Filters = {
  "OPCODE:FATAL": true,
  "OPCODE:WARNING": true,
  "OPCODE_SHARED:WARNING": true,
  "OPCODE_SHARED:FATAL": true,
  "CSR:FATAL": true,
  "CSR:WARNING": true,
  "CUSTOM_SPACE:FATAL": true,
  "CUSTOM_SPACE:WARNING": false,
};

const EDGE_STYLES: Record<
  FilterKey,
  { stroke: string; label: string; description: string }
> = {
  "OPCODE:FATAL": {
    stroke: "rgb(239 68 68)",
    label: "Opcode FATAL",
    description: "Same encoding tuple, different mnemonics — real hardware conflict.",
  },
  "OPCODE:WARNING": {
    stroke: "rgb(234 179 8)",
    label: "Opcode WARNING",
    description: "Opcode conflict but at least one side is remappable.",
  },
  "OPCODE_SHARED:WARNING": {
    stroke: "rgb(34 211 238)",
    label: "Shared instruction",
    description:
      "Same encoding + same mnemonic = same instruction by spec (designed overlap).",
  },
  "OPCODE_SHARED:FATAL": {
    stroke: "rgb(34 211 238)",
    label: "Shared instruction (FATAL?)",
    description: "Unusual — shared mnemonic flagged FATAL.",
  },
  "CSR:FATAL": {
    stroke: "rgb(168 85 247)",
    label: "CSR FATAL",
    description: "Overlapping CSR addresses on non-remappable extensions.",
  },
  "CSR:WARNING": {
    stroke: "rgb(192 132 252)",
    label: "CSR WARNING",
    description: "Overlapping CSR addresses; remappable.",
  },
  "CUSTOM_SPACE:FATAL": {
    stroke: "rgb(120 113 108)",
    label: "Custom-space FATAL",
    description: "Both claim the same custom-N major opcode space.",
  },
  "CUSTOM_SPACE:WARNING": {
    stroke: "rgb(168 162 158)",
    label: "Custom-space WARNING",
    description: "Both reach for the same custom-N opcode space. Common in vendor catalogs.",
  },
};

function rlColor(rl: number | null): string {
  switch (rl) {
    case 5:
      return "rgb(34 197 94)";
    case 4:
      return "rgb(132 204 22)";
    case 3:
      return "rgb(234 179 8)";
    case 2:
      return "rgb(249 115 22)";
    case 1:
    default:
      return "rgb(120 113 108)";
  }
}

function edgeKey(e: { type: ExtensionConflictType; severity: ExtensionConflictSeverity }): FilterKey {
  return `${e.type}:${e.severity}` as FilterKey;
}

export function CompatibilityGraph({ graph }: { graph: CollisionGraph }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const innerGroupRef = useRef<SVGGElement | null>(null);
  const simRef = useRef<Simulation<SimNode, SimEdge> | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [size, setSize] = useState({ width: 1000, height: 700 });
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState("");
  const [hideIsolated, setHideIsolated] = useState(true);
  const [hoveredEdge, setHoveredEdge] = useState<SimEdge | null>(null);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [tick, setTick] = useState(0);

  // Re-render on every simulation tick so node positions visibly update.
  void tick;

  // Visible edges from the props.
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

  // Build the set of node ids touched by at least one visible edge.
  const connectedIds = useMemo(() => {
    const s = new Set<string>();
    for (const e of visibleEdges) {
      const src = typeof e.source === "object" ? (e.source as SimNode).id : String(e.source);
      const tgt = typeof e.target === "object" ? (e.target as SimNode).id : String(e.target);
      s.add(src);
      s.add(tgt);
    }
    return s;
  }, [visibleEdges]);

  // Stable nodes list — only the ones that should be in the simulation. When
  // `hideIsolated` is on (default), drops the (usually large) tail of nodes
  // that have zero visible edges, which is what previously made the canvas
  // look mostly empty even though the graph "had" 102 nodes.
  const simNodes = useMemo<SimNode[]>(() => {
    const all = graph.nodes;
    if (!hideIsolated) return all.map((n) => ({ ...n }));
    return all.filter((n) => connectedIds.has(n.id)).map((n) => ({ ...n }));
  }, [graph.nodes, connectedIds, hideIsolated]);

  // Highlight search: returns the set of node ids matching the query, or null
  // when query is empty (no dimming).
  const highlightedIds = useMemo(() => {
    if (!query.trim()) return null;
    const needle = query.trim().toLowerCase();
    return new Set(
      simNodes
        .filter(
          (n) =>
            n.slug.toLowerCase().includes(needle) ||
            n.name.toLowerCase().includes(needle),
        )
        .map((n) => n.id),
    );
  }, [simNodes, query]);

  // Force simulation: re-create whenever the visible subgraph changes.
  useEffect(() => {
    if (!size.width) return;

    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimEdge>(visibleEdges)
          .id((d) => d.id)
          .distance(80)
          .strength(0.5),
      )
      .force("charge", forceManyBody<SimNode>().strength(-180))
      .force("center", forceCenter(size.width / 2, size.height / 2))
      .force("x", forceX<SimNode>(size.width / 2).strength(0.04))
      .force("y", forceY<SimNode>(size.height / 2).strength(0.04))
      .force("collide", forceCollide<SimNode>().radius(20))
      .on("tick", () => setTick((t) => (t + 1) % 1_000_000));

    simRef.current = sim;
    return () => {
      sim.stop();
    };
  }, [simNodes, visibleEdges, size.width, size.height]);

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

  // Wire d3-zoom to the SVG; apply the transform via React state so nodes/edges
  // re-render in the new viewport.
  useEffect(() => {
    if (!svgRef.current) return;
    const svgSel = select(svgRef.current);
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .filter((event) => {
        // Block zoom when interacting with a node circle so drag works cleanly.
        const target = event.target as Element | null;
        if (target?.closest?.("[data-node='1']")) return false;
        return !event.ctrlKey && !event.button;
      })
      .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        const { x, y, k } = event.transform;
        setTransform({ x, y, k });
      });
    zoomBehaviorRef.current = z;
    svgSel.call(z);
    return () => {
      svgSel.on(".zoom", null);
    };
  }, []);

  // Wire d3-drag for individual node movement, reheating the simulation while
  // the node is held. Re-binds after every simulation rebuild because the
  // simulation reference changes.
  useEffect(() => {
    if (!innerGroupRef.current || !simRef.current) return;
    const sim = simRef.current;
    const sel = select(innerGroupRef.current).selectAll<SVGGElement, SimNode>("[data-node='1']");
    const dragger = d3drag<SVGGElement, SimNode>()
      .on("start", (event: D3DragEvent<SVGGElement, SimNode, SimNode>, d) => {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event: D3DragEvent<SVGGElement, SimNode, SimNode>, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event: D3DragEvent<SVGGElement, SimNode, SimNode>, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    sel.call(dragger);
  }, [simNodes, visibleEdges]);

  function resetZoom() {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    // Instant reset — avoids pulling in d3-transition just for one fade.
    select(svgRef.current).call(zoomBehaviorRef.current.transform, zoomIdentity);
  }

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-3">
        <input
          type="search"
          placeholder="Filter nodes (slug or name)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full min-w-0 max-w-xs rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-auto"
        />
        <label className="flex cursor-pointer items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={hideIsolated}
            onChange={(e) => setHideIsolated(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          <span>Hide isolated nodes</span>
        </label>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={resetZoom}
            className="rounded-md border bg-background px-2.5 py-1 text-xs hover:bg-muted"
            title="Reset zoom"
          >
            Reset view
          </button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {(transform.k * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex w-full flex-wrap gap-1.5">
          {(Object.entries(EDGE_STYLES) as Array<[FilterKey, (typeof EDGE_STYLES)[FilterKey]]>)
            .filter(([k]) => graph.stats.byTypeSeverity[k] !== undefined)
            .map(([k, style]) => {
              const active = filters[k];
              const count = graph.stats.byTypeSeverity[k] ?? 0;
              return (
                <button
                  key={k}
                  onClick={() => setFilters((f) => ({ ...f, [k]: !f[k] }))}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition " +
                    (active ? "bg-background" : "bg-muted text-muted-foreground opacity-60")
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

      {/* Graph */}
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
          style={{ cursor: "grab", touchAction: "none" }}
        >
          <defs>
            <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="white" stopOpacity={0.35} />
              <stop offset="100%" stopColor="white" stopOpacity={0} />
            </radialGradient>
          </defs>

          {/* All zoomable content lives in this inner group. */}
          <g
            ref={innerGroupRef}
            transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}
          >
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
                const k = edgeKey({ type: e.edgeType, severity: e.severity });
                const style = EDGE_STYLES[k];
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
                    strokeWidth={isHovered ? 2.6 / transform.k : 1.4 / transform.k}
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
              {simNodes.map((n) => {
                if (n.x == null || n.y == null) return null;
                const dimByQuery = highlightedIds && !highlightedIds.has(n.id);
                const opacity = dimByQuery ? 0.18 : 1;
                const r = (hoveredNode === n ? 11 : 8) / Math.sqrt(transform.k);
                return (
                  <g
                    key={n.id}
                    data-node="1"
                    transform={`translate(${n.x},${n.y})`}
                    style={{ cursor: "grab" }}
                    opacity={opacity}
                    onMouseEnter={() => setHoveredNode(n)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={(e) => {
                      // Only treat as click if the user didn't drag.
                      if (e.detail >= 1) {
                        window.location.href = `/package/${encodeURIComponent(n.slug)}`;
                      }
                    }}
                  >
                    <circle r={r + 5} fill="url(#node-glow)" pointerEvents="none" />
                    <circle
                      r={r}
                      fill={rlColor(n.rl)}
                      stroke="rgba(0,0,0,0.4)"
                      strokeWidth={0.8 / transform.k}
                    />
                    {(hoveredNode === n || (highlightedIds && highlightedIds.has(n.id))) && (
                      <text
                        x={r + 6}
                        y={4}
                        fontSize={12 / transform.k}
                        fill="currentColor"
                        style={{ pointerEvents: "none", userSelect: "none" }}
                      >
                        {n.slug}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </g>
        </svg>

        {/* Tooltip */}
        {(hoveredEdge || hoveredNode) && (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 max-w-2xl rounded-md border bg-background/95 px-3 py-2 text-sm shadow-md backdrop-blur">
            {hoveredEdge ? (
              <div>
                <div className="font-semibold">
                  {EDGE_STYLES[edgeKey({ type: hoveredEdge.edgeType, severity: hoveredEdge.severity })]?.label}
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
                <div className="text-xs text-muted-foreground">
                  Click to open · drag to reposition
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Hint row */}
        <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-background/80 px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground shadow">
          drag · scroll to zoom
        </div>
      </div>

      {/* Legend */}
      <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
        <div className="mb-2 font-semibold text-foreground">Reading the graph</div>
        <ul className="space-y-1">
          <li>
            <strong className="text-foreground">Nodes</strong> = published
            extensions. Color = Readiness Level (RL5 green → RL1 stone).
            Drag to reposition. Click to open the package page.
          </li>
          <li>
            <strong className="text-foreground">Edges</strong> = collisions
            detected by the registry. Hover for the encoding detail.
          </li>
          <li>
            <strong style={{ color: "rgb(34 211 238)" }}>Cyan</strong> edges
            (SHARED) are <em>designed overlaps</em>, not real conflicts — e.g.
            Zbkb&apos;s <code>rol</code> and Zbb&apos;s <code>rol</code> are the
            same instruction by spec.
          </li>
          <li>
            <strong>Scroll</strong> to zoom · <strong>drag the canvas</strong>{" "}
            to pan. Use “Reset view” to recenter.
          </li>
          <li>
            “Hide isolated nodes” drops extensions with no visible edge from
            the canvas (otherwise they drift around as untethered points).
          </li>
        </ul>
      </div>
    </div>
  );
}

// Re-export the unused-types so TS sees them as "used" if the component is consumed.
export type { CollisionGraphEdge as _CollisionGraphEdge };
