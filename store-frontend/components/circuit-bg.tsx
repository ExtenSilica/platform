"use client";

export function CircuitBackground({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <pattern id="circuit-grid" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="1.5" fill="currentColor" opacity="0.15" />
          <circle cx="30" cy="0" r="1.5" fill="currentColor" opacity="0.15" />
          <circle cx="60" cy="0" r="1.5" fill="currentColor" opacity="0.15" />
          <circle cx="0" cy="30" r="1.5" fill="currentColor" opacity="0.15" />
          <circle cx="30" cy="30" r="1.5" fill="currentColor" opacity="0.15" />
          <circle cx="60" cy="30" r="1.5" fill="currentColor" opacity="0.15" />
          <circle cx="0" cy="60" r="1.5" fill="currentColor" opacity="0.15" />
          <circle cx="30" cy="60" r="1.5" fill="currentColor" opacity="0.15" />
          <circle cx="60" cy="60" r="1.5" fill="currentColor" opacity="0.15" />
          <line x1="0" y1="30" x2="15" y2="30" stroke="currentColor" strokeWidth="0.5" opacity="0.12" />
          <line x1="45" y1="30" x2="60" y2="30" stroke="currentColor" strokeWidth="0.5" opacity="0.12" />
          <line x1="30" y1="0" x2="30" y2="12" stroke="currentColor" strokeWidth="0.5" opacity="0.12" />
          <line x1="30" y1="48" x2="30" y2="60" stroke="currentColor" strokeWidth="0.5" opacity="0.12" />
          <line x1="15" y1="30" x2="22" y2="23" stroke="currentColor" strokeWidth="0.5" opacity="0.10" />
          <line x1="22" y1="23" x2="30" y2="23" stroke="currentColor" strokeWidth="0.5" opacity="0.10" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#circuit-grid)" />
    </svg>
  );
}

/**
 * Hero-only backdrop: layered grid → irregular flow lines → pipeline → micro texture → radials.
 * Uses CSS variables for theme-aware “execution zone” (see globals.css --hero-*).
 */
export function PipelineBackground({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        {/* ── LAYER 1: dot grid (unchanged logic, slightly softer) ── */}
        <pattern id="hero-dots" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
          <circle cx="24" cy="24" r="1" fill="currentColor" opacity="0.11" />
        </pattern>

        {/* Horizontal edge fade for flow layer */}
        <linearGradient id="hero-flow-mask-grad" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="14%" stopColor="#fff" stopOpacity="1" />
          <stop offset="86%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="hero-flow-edge-mask" x="0" y="0" width="100%" height="100%">
          <rect width="100%" height="100%" fill="url(#hero-flow-mask-grad)" />
        </mask>

        {/* LAYER 2: irregular 1px horizontal flow lines (3–6% feel) */}
        <pattern id="hero-flow-irregular" x="0" y="0" width="420" height="220" patternUnits="userSpaceOnUse">
          <line x1="0" y1="13" x2="420" y2="13" stroke="currentColor" strokeWidth="1" opacity="0.045" />
          <line x1="0" y1="29" x2="420" y2="29" stroke="currentColor" strokeWidth="1" opacity="0.038" />
          <line x1="0" y1="44" x2="420" y2="44" stroke="currentColor" strokeWidth="1" opacity="0.052" />
          <line x1="0" y1="61" x2="420" y2="61" stroke="currentColor" strokeWidth="1" opacity="0.04" />
          <line x1="0" y1="78" x2="420" y2="78" stroke="currentColor" strokeWidth="1" opacity="0.055" />
          <line x1="0" y1="97" x2="420" y2="97" stroke="currentColor" strokeWidth="1" opacity="0.035" />
          <line x1="0" y1="118" x2="420" y2="118" stroke="currentColor" strokeWidth="1" opacity="0.048" />
          <line x1="0" y1="141" x2="420" y2="141" stroke="currentColor" strokeWidth="1" opacity="0.042" />
          <line x1="0" y1="168" x2="420" y2="168" stroke="currentColor" strokeWidth="1" opacity="0.036" />
          <line x1="0" y1="198" x2="420" y2="198" stroke="currentColor" strokeWidth="1" opacity="0.032" />
        </pattern>

        {/* LAYER 3: pipeline / bus (reduced vs before — less visual noise) */}
        <pattern id="hero-pipes" x="0" y="0" width="240" height="100" patternUnits="userSpaceOnUse">
          <line x1="0" y1="20" x2="240" y2="20" stroke="currentColor" strokeWidth="0.5" opacity="0.045" />
          <line x1="0" y1="50" x2="240" y2="50" stroke="currentColor" strokeWidth="0.55" opacity="0.052" />
          <line x1="0" y1="80" x2="240" y2="80" stroke="currentColor" strokeWidth="0.5" opacity="0.038" />
          <line x1="0" y1="35" x2="240" y2="35" stroke="currentColor" strokeWidth="0.3" strokeDasharray="6 8" opacity="0.032" />
          <line x1="0" y1="65" x2="240" y2="65" stroke="currentColor" strokeWidth="0.3" strokeDasharray="4 10" opacity="0.028" />
          <polygon points="70,18 78,20 70,22" fill="currentColor" opacity="0.045" />
          <polygon points="180,18 188,20 180,22" fill="currentColor" opacity="0.032" />
          <polygon points="40,48 48,50 40,52" fill="currentColor" opacity="0.048" />
          <polygon points="130,48 138,50 130,52" fill="currentColor" opacity="0.038" />
          <polygon points="210,48 218,50 210,52" fill="currentColor" opacity="0.032" />
          <polygon points="100,78 108,80 100,82" fill="currentColor" opacity="0.038" />
          <polygon points="200,78 208,80 200,82" fill="currentColor" opacity="0.032" />
          <line x1="60" y1="15" x2="60" y2="25" stroke="currentColor" strokeWidth="0.4" opacity="0.038" />
          <line x1="120" y1="15" x2="120" y2="25" stroke="currentColor" strokeWidth="0.4" opacity="0.038" />
          <line x1="180" y1="15" x2="180" y2="25" stroke="currentColor" strokeWidth="0.4" opacity="0.038" />
          <line x1="60" y1="45" x2="60" y2="55" stroke="currentColor" strokeWidth="0.4" opacity="0.038" />
          <line x1="120" y1="45" x2="120" y2="55" stroke="currentColor" strokeWidth="0.4" opacity="0.038" />
          <line x1="180" y1="45" x2="180" y2="55" stroke="currentColor" strokeWidth="0.4" opacity="0.038" />
          <rect x="58" y="46" width="4" height="8" rx="0.5" fill="currentColor" opacity="0.028" />
          <rect x="118" y="46" width="4" height="8" rx="0.5" fill="currentColor" opacity="0.028" />
          <rect x="178" y="46" width="4" height="8" rx="0.5" fill="currentColor" opacity="0.028" />
          <text x="85" y="34" fontSize="4" fontFamily="monospace" fill="currentColor" opacity="0.028">ADDI</text>
          <text x="145" y="64" fontSize="4" fontFamily="monospace" fill="currentColor" opacity="0.024">LD</text>
          <text x="30" y="34" fontSize="4" fontFamily="monospace" fill="currentColor" opacity="0.024">BEQ</text>
          <text x="200" y="34" fontSize="4" fontFamily="monospace" fill="currentColor" opacity="0.022">JALR</text>
        </pattern>

        {/* LAYER 4a: data micro-segments */}
        <pattern id="hero-datastream" x="0" y="0" width="160" height="40" patternUnits="userSpaceOnUse">
          <line x1="0" y1="8" x2="42" y2="8" stroke="currentColor" strokeWidth="0.35" strokeDasharray="3 5 2 5 4 8" opacity="0.022" />
          <line x1="88" y1="8" x2="160" y2="8" stroke="currentColor" strokeWidth="0.35" strokeDasharray="2 6 3 6" opacity="0.018" />
          <line x1="12" y1="22" x2="120" y2="22" stroke="currentColor" strokeWidth="0.3" strokeDasharray="1 4 1 4 2 10" opacity="0.02" />
          <line x1="0" y1="32" x2="70" y2="32" stroke="currentColor" strokeWidth="0.28" strokeDasharray="5 7 2 12" opacity="0.016" />
          <circle cx="52" cy="8" r="0.55" fill="currentColor" opacity="0.022" />
          <circle cx="134" cy="22" r="0.55" fill="currentColor" opacity="0.018" />
        </pattern>

        {/* LAYER 4b: trace-like PCB hints */}
        <pattern id="hero-pcb-traces" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
          <path d="M0 120 L40 100 L72 100 L90 130" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.018" />
          <path d="M120 0 L140 48 L180 60 L200 40" fill="none" stroke="currentColor" strokeWidth="0.35" opacity="0.015" />
          <path d="M10 180 L55 155 L100 170 L130 200" fill="none" stroke="currentColor" strokeWidth="0.3" opacity="0.016" />
          <line x1="160" y1="140" x2="200" y2="120" stroke="currentColor" strokeWidth="0.35" opacity="0.014" />
        </pattern>

        {/* Title / upper pipeline glow — reduced (terminal is primary anchor) */}
        <radialGradient id="hero-glow-title" cx="50%" cy="28%" r="30%" fx="50%" fy="28%">
          <stop offset="0%" stopColor="hsl(var(--hero-title-radial))" stopOpacity="0.02" />
          <stop offset="55%" stopColor="hsl(var(--hero-title-radial))" stopOpacity="0.006" />
          <stop offset="100%" stopColor="hsl(var(--hero-title-radial))" stopOpacity="0" />
        </radialGradient>

        {/* Terminal “execution zone” — primary focal glow */}
        <radialGradient id="hero-glow-terminal-wide" cx="50%" cy="81%" r="56%" fx="50%" fy="81%">
          <stop offset="0%" stopColor="hsl(var(--hero-terminal-radial-inner))" stopOpacity="0.085" />
          <stop offset="38%" stopColor="hsl(var(--hero-terminal-radial-mid))" stopOpacity="0.045" />
          <stop offset="72%" stopColor="hsl(var(--hero-terminal-radial-edge))" stopOpacity="0.018" />
          <stop offset="100%" stopColor="hsl(var(--hero-terminal-radial-edge))" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="hero-glow-terminal" cx="50%" cy="80%" r="30%" fx="50%" fy="80%">
          <stop offset="0%" stopColor="hsl(var(--hero-terminal-radial-inner))" stopOpacity="0.11" />
          <stop offset="50%" stopColor="hsl(var(--hero-terminal-radial-mid))" stopOpacity="0.04" />
          <stop offset="100%" stopColor="hsl(var(--hero-terminal-radial-edge))" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* LAYER 1 — base grid */}
      <g style={{ color: "hsl(var(--riscv))" }}>
        <rect width="100%" height="100%" fill="url(#hero-dots)" />
      </g>

      {/* LAYER 2 — irregular flow lines + edge fade */}
      <g style={{ color: "hsl(var(--hero-flow-line))" }}>
        <rect width="100%" height="100%" fill="url(#hero-flow-irregular)" mask="url(#hero-flow-edge-mask)" />
      </g>

      {/* LAYER 3 — pipeline / lanes */}
      <g style={{ color: "hsl(var(--riscv))" }}>
        <rect width="100%" height="100%" fill="url(#hero-pipes)" opacity="0.88" />
      </g>

      {/* LAYER 4 — micro texture */}
      <g style={{ color: "hsl(var(--riscv))" }}>
        <rect width="100%" height="100%" fill="url(#hero-datastream)" opacity="0.85" />
        <rect width="100%" height="100%" fill="url(#hero-pcb-traces)" opacity="0.75" />
      </g>

      {/* LAYER 5 — subtle upper glow (de-emphasized) */}
      <rect width="100%" height="100%" fill="url(#hero-glow-title)" />

      {/* LAYER 6–7 — terminal execution zone (stronger anchor) */}
      <rect width="100%" height="100%" fill="url(#hero-glow-terminal-wide)" />
      <rect width="100%" height="100%" fill="url(#hero-glow-terminal)" />
    </svg>
  );
}

const HERO_HEX_FRAGMENTS = [
  { x: "8%", y: "72%", text: "0xC0DE" },
  { x: "84%", y: "68%", text: "101100" },
  { x: "52%", y: "88%", text: "0xFEED" },
];

const DEFAULT_HEX_FRAGMENTS = [
  { x: "5%", y: "15%", text: "0x52495343" },
  { x: "78%", y: "8%", text: "0xDEAD" },
  { x: "20%", y: "82%", text: "101010" },
  { x: "88%", y: "75%", text: "0xFF" },
  { x: "45%", y: "92%", text: "0b1101" },
  { x: "65%", y: "20%", text: "RV64" },
  { x: "10%", y: "50%", text: "0x2A" },
  { x: "92%", y: "45%", text: "110011" },
];

export function HexOverlay({
  className = "",
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "hero";
}) {
  const fragments = variant === "hero" ? HERO_HEX_FRAGMENTS : DEFAULT_HEX_FRAGMENTS;
  const opacityClass = variant === "hero" ? "opacity-[0.022]" : "opacity-[0.04]";
  const blurStyle = variant === "hero" ? { filter: "blur(0.85px)" } : undefined;

  return (
    <div className={className} aria-hidden="true">
      {fragments.map(({ x, y, text }) => (
        <span
          key={`${x}${y}${text}`}
          className={`absolute select-none font-mono text-[9px] text-current ${opacityClass}`}
          style={{ left: x, top: y, ...blurStyle }}
        >
          {text}
        </span>
      ))}
    </div>
  );
}

export function ChipDie({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="50" y="50" width="100" height="100" rx="4" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" />

      <rect x="65" y="65" width="70" height="70" rx="2" fill="currentColor" fillOpacity="0.05" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.15" />

      <rect x="72" y="72" width="22" height="22" rx="1" fill="currentColor" opacity="0.08" />
      <rect x="98" y="72" width="30" height="10" rx="1" fill="currentColor" opacity="0.06" />
      <rect x="98" y="86" width="30" height="8" rx="1" fill="currentColor" opacity="0.06" />
      <rect x="72" y="98" width="56" height="30" rx="1" fill="currentColor" opacity="0.05" />

      {[65, 80, 95, 110, 125].map((x) => (
        <g key={`t${x}`}>
          <line x1={x} y1="50" x2={x} y2="30" stroke="currentColor" strokeWidth="1" opacity="0.2" />
          <rect x={x - 2} y="26" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.2" />
        </g>
      ))}
      {[65, 80, 95, 110, 125].map((x) => (
        <g key={`b${x}`}>
          <line x1={x} y1="150" x2={x} y2="170" stroke="currentColor" strokeWidth="1" opacity="0.2" />
          <rect x={x - 2} y="170" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.2" />
        </g>
      ))}
      {[65, 80, 95, 110, 125].map((y) => (
        <g key={`l${y}`}>
          <line x1="50" y1={y} x2="30" y2={y} stroke="currentColor" strokeWidth="1" opacity="0.2" />
          <rect x="26" y={y - 2} width="4" height="4" rx="0.5" fill="currentColor" opacity="0.2" />
        </g>
      ))}
      {[65, 80, 95, 110, 125].map((y) => (
        <g key={`r${y}`}>
          <line x1="150" y1={y} x2="170" y2={y} stroke="currentColor" strokeWidth="1" opacity="0.2" />
          <rect x="170" y={y - 2} width="4" height="4" rx="0.5" fill="currentColor" opacity="0.2" />
        </g>
      ))}

      <circle cx="57" cy="57" r="2" fill="currentColor" opacity="0.2" />

      <text x="100" y="120" textAnchor="middle" fontSize="7" fontFamily="monospace" fill="currentColor" opacity="0.2" fontWeight="bold">
        RISC-V
      </text>
      <text x="100" y="108" textAnchor="middle" fontSize="5" fontFamily="monospace" fill="currentColor" opacity="0.15">
        .xsil core
      </text>
    </svg>
  );
}
