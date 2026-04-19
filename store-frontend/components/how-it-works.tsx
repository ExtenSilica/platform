"use client";

import { useEffect, useRef, useState } from "react";
import { FileCode2, PackageCheck, Upload, Download, Cpu } from "lucide-react";

const STEPS = [
  {
    icon: FileCode2,
    label: "Write",
    detail: "Author your RISC-V extension with a manifest.json and a RISC-V toolchain",
    code: "manifest.json",
  },
  {
    icon: PackageCheck,
    label: "Package",
    detail: "The CLI bundles your RISC-V extension into a .xsil archive with SHA-256 checksums",
    code: ".xsil",
  },
  {
    icon: Upload,
    label: "Publish",
    detail: "xsil publish uploads to the registry — indexed and discoverable instantly",
    code: "xsil publish",
  },
  {
    icon: Download,
    label: "Install",
    detail: "Anyone can install a RISC-V extension with a single command, verified by checksum",
    code: "xsil install",
  },
  {
    icon: Cpu,
    label: "Run on silicon",
    detail: "Execute on a RISC-V simulator (Spike/QEMU), FPGA, or real hardware",
    code: "xsil run",
  },
];

function useInView(ref: React.RefObject<HTMLElement | null>, threshold = 0.3) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, threshold]);
  return visible;
}

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduce;
}

const PIPELINE_INTERVAL_MS = 3400;

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const visible = useInView(sectionRef);
  const reduceMotion = usePrefersReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!visible || reduceMotion) return;
    const id = setInterval(() => {
      setActiveIndex((i) => (i + 1) % STEPS.length);
    }, PIPELINE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [visible, reduceMotion]);

  useEffect(() => {
    if (visible) setActiveIndex(0);
  }, [visible]);

  const motionLine = visible && !reduceMotion;

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden border-b bg-gradient-to-b from-riscv/[0.04] to-transparent px-4 py-16"
    >
      {/* section heading */}
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-riscv/20 bg-riscv/[0.07] px-3 py-1 text-xs font-medium text-riscv">
          <Cpu className="h-3 w-3" />
          From code to silicon
        </div>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Execution pipeline
        </h2>
        <p className="mt-2 text-muted-foreground">
          From source code to execution on a RISC-V environment.
        </p>
      </div>

      {/* steps */}
      <div className="mx-auto max-w-5xl">
        <div className="relative flex flex-col gap-0 md:flex-row md:items-start md:justify-between md:gap-0">
          {/* connecting line (desktop) */}
          <div className="absolute left-0 right-0 top-10 hidden h-1 md:block">
            {/* base gradient track */}
            <div
              className="absolute inset-0 rounded-full transition-all duration-[2000ms] ease-out"
              style={{
                width: visible ? "100%" : "0%",
                background: "linear-gradient(to right, hsl(var(--brand) / 0.5), hsl(var(--riscv) / 0.7), hsl(var(--riscv-accent) / 0.6), hsl(var(--riscv) / 0.8), hsl(var(--riscv-light)))",
              }}
            />
            {/* bright core line */}
            <div
              className="absolute inset-y-[2px] left-0 rounded-full transition-all duration-[2000ms] ease-out"
              style={{
                width: visible ? "100%" : "0%",
                background: "linear-gradient(to right, hsl(var(--brand)), hsl(var(--riscv)), hsl(var(--riscv-accent)), hsl(var(--riscv-light)))",
              }}
            />
            {/* very slow soft highlight (data flow) */}
            {motionLine && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                <div
                  className="absolute inset-0 animate-[flow-sweep_14s_linear_infinite]"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent 0%, transparent 32%, hsl(var(--riscv-accent) / 0.35) 50%, transparent 68%, transparent 100%)",
                    backgroundSize: "400% 100%",
                    opacity: 0.5,
                  }}
                />
                <div
                  className="absolute inset-0 animate-[flow-sweep-soft_14s_linear_infinite]"
                  style={{
                    animationDelay: "-7s",
                    background:
                      "linear-gradient(90deg, transparent 0%, transparent 38%, hsl(0 0% 100% / 0.22) 50%, transparent 62%, transparent 100%)",
                    backgroundSize: "350% 100%",
                    mixBlendMode: "overlay",
                  }}
                />
              </div>
            )}
          </div>
          {/* connecting line (mobile) */}
          <div className="absolute bottom-0 left-10 top-0 w-1 md:hidden">
            <div
              className="absolute inset-0 rounded-full transition-all duration-[2000ms] ease-out"
              style={{
                height: visible ? "100%" : "0%",
                background: "linear-gradient(to bottom, hsl(var(--brand) / 0.5), hsl(var(--riscv) / 0.7), hsl(var(--riscv-accent) / 0.6), hsl(var(--riscv) / 0.8), hsl(var(--riscv-light)))",
              }}
            />
            <div
              className="absolute inset-x-[2px] top-0 rounded-full transition-all duration-[2000ms] ease-out"
              style={{
                height: visible ? "100%" : "0%",
                background: "linear-gradient(to bottom, hsl(var(--brand)), hsl(var(--riscv)), hsl(var(--riscv-accent)), hsl(var(--riscv-light)))",
              }}
            />
            {motionLine && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                <div
                  className="absolute inset-0 animate-[flow-sweep-v_14s_linear_infinite]"
                  style={{
                    background:
                      "linear-gradient(180deg, transparent 0%, transparent 32%, hsl(var(--riscv-accent) / 0.35) 50%, transparent 68%, transparent 100%)",
                    backgroundSize: "100% 400%",
                    opacity: 0.5,
                  }}
                />
                <div
                  className="absolute inset-0 animate-[flow-sweep-soft-v_14s_linear_infinite]"
                  style={{
                    animationDelay: "-7s",
                    background:
                      "linear-gradient(180deg, transparent 0%, transparent 38%, hsl(0 0% 100% / 0.22) 50%, transparent 62%, transparent 100%)",
                    backgroundSize: "100% 350%",
                    mixBlendMode: "overlay",
                  }}
                />
              </div>
            )}
          </div>

          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isLast = i === STEPS.length - 1;
            const delay = i * 300;
            const isActive = reduceMotion ? isLast : i === activeIndex;

            return (
              <div
                key={step.label}
                className="relative z-10 flex items-start gap-4 md:flex-col md:items-center md:gap-3 md:flex-1 md:px-2"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(24px)",
                  transition: `opacity 600ms ${delay}ms ease-out, transform 600ms ${delay}ms ease-out`,
                }}
              >
                {/* icon + glow (glow layer behind) */}
                <div className="relative shrink-0">
                  {isActive && visible && !reduceMotion && (
                    <div
                      className="pointer-events-none absolute left-1/2 top-1/2 h-[5.25rem] w-[5.25rem] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-riscv-accent/20 blur-lg motion-safe:animate-pulse"
                      aria-hidden
                    />
                  )}
                  <div
                    className={`group/icon relative flex h-20 w-20 items-center justify-center rounded-2xl border-2 transition-all duration-700 ease-out ${
                      isActive
                        ? "z-10 scale-[1.04] border-riscv-accent bg-gradient-to-br from-riscv to-riscv-accent text-white shadow-[0_0_28px_hsl(var(--riscv-accent)/0.42),0_0_48px_hsl(var(--riscv-accent)/0.12)] ring-2 ring-riscv-accent/25 hover:shadow-[0_0_36px_hsl(var(--riscv-accent)/0.5)]"
                        : "z-10 scale-100 border-border/70 bg-muted/40 text-riscv/50 shadow-none hover:border-riscv/35 hover:bg-background hover:text-riscv/80 dark:border-border/50 dark:bg-muted/25"
                    }`}
                    style={{ transitionDelay: `${delay + 200}ms` }}
                  >
                    <Icon
                      className={`h-8 w-8 transition-transform duration-300 group-hover/icon:scale-110 ${isActive ? "drop-shadow-[0_1px_3px_rgb(0_0_0_/_0.35)]" : ""}`}
                      strokeWidth={isActive ? 2.35 : 1.65}
                    />
                  </div>
                </div>

                {/* text */}
                <div className={`min-w-0 py-2 md:text-center transition-opacity duration-500 ${isActive ? "" : "opacity-[0.82]"}`}>
                  <p className={`text-sm font-bold ${isActive ? "text-foreground" : "text-foreground/50"}`}>{step.label}</p>
                  <p className={`mt-0.5 text-xs leading-relaxed ${isActive ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                    {step.detail}
                  </p>
                  <code
                    className={`mt-1.5 inline-block rounded px-2 py-0.5 font-mono text-[10px] ${
                      isActive ? "bg-riscv-accent/[0.12] text-riscv-accent" : "bg-muted/80 text-muted-foreground/80"
                    }`}
                  >
                    {step.code}
                  </code>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* decorative chip pinout corners */}
      <svg className="absolute bottom-0 left-0 h-24 w-24 text-riscv/[0.08]" viewBox="0 0 100 100" aria-hidden="true">
        {[20, 40, 60, 80].map((y) => (
          <g key={y}>
            <line x1="0" y1={y} x2="15" y2={y} stroke="currentColor" strokeWidth="2" />
            <circle cx="15" cy={y} r="2" fill="currentColor" />
          </g>
        ))}
        {[20, 40, 60, 80].map((x) => (
          <g key={`b${x}`}>
            <line x1={x} y1="100" x2={x} y2="85" stroke="currentColor" strokeWidth="2" />
            <circle cx={x} cy="85" r="2" fill="currentColor" />
          </g>
        ))}
      </svg>
      <svg className="absolute right-0 top-0 h-24 w-24 rotate-180 text-riscv/[0.08]" viewBox="0 0 100 100" aria-hidden="true">
        {[20, 40, 60, 80].map((y) => (
          <g key={y}>
            <line x1="0" y1={y} x2="15" y2={y} stroke="currentColor" strokeWidth="2" />
            <circle cx="15" cy={y} r="2" fill="currentColor" />
          </g>
        ))}
        {[20, 40, 60, 80].map((x) => (
          <g key={`b${x}`}>
            <line x1={x} y1="100" x2={x} y2="85" stroke="currentColor" strokeWidth="2" />
            <circle cx={x} cy="85" r="2" fill="currentColor" />
          </g>
        ))}
      </svg>
    </section>
  );
}
