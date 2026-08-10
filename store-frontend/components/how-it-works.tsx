"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Download, Package, Search, Upload } from "lucide-react";

const STEPS = [
  {
    icon: Search,
    label: "Discover",
    detail: "Search standards, vendor extensions, and experimental work in one catalog",
    code: "xsil search <query>",
  },
  {
    icon: BookOpen,
    label: "Inspect",
    detail: "Review provenance, ISA metadata, documentation, versions, and artifacts",
    code: "xsil info <extension>",
  },
  {
    icon: Package,
    label: "Package",
    detail: "Capture an extension and its available technical context in the open format",
    code: "manifest.json + artifacts",
  },
  {
    icon: Upload,
    label: "Publish",
    detail: "Release an immutable, checksummed version under a canonical registry name",
    code: "xsil publish",
  },
  {
    icon: Download,
    label: "Reuse",
    detail: "Install the preserved package and carry its context into new work",
    code: "xsil install <extension>",
  },
];

function useInView(ref: React.RefObject<HTMLElement | null>, threshold = 0.3) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
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
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-riscv/20 bg-riscv/[0.07] px-3 py-1 text-xs font-medium text-riscv">
          The .xsil workflow
        </div>
        <h2 className="text-2xl font-bold sm:text-3xl">From discovery to a reusable package</h2>
        <p className="mt-2 text-muted-foreground">
          ExtenSilica keeps extension metadata, releases, and available artifacts together.
        </p>
      </div>

      <div className="mx-auto max-w-5xl">
        <div className="relative flex flex-col gap-0 md:flex-row md:items-start md:justify-between md:gap-0">
          <div className="absolute left-0 right-0 top-10 hidden h-1 md:block">
            <div
              className="absolute inset-0 rounded-full transition-all duration-[2000ms] ease-out"
              style={{
                width: visible ? "100%" : "0%",
                background:
                  "linear-gradient(to right, hsl(var(--brand) / 0.5), hsl(var(--riscv) / 0.7), hsl(var(--riscv-accent) / 0.6), hsl(var(--riscv) / 0.8), hsl(var(--riscv-light)))",
              }}
            />
            <div
              className="absolute inset-y-[2px] left-0 rounded-full transition-all duration-[2000ms] ease-out"
              style={{
                width: visible ? "100%" : "0%",
                background:
                  "linear-gradient(to right, hsl(var(--brand)), hsl(var(--riscv)), hsl(var(--riscv-accent)), hsl(var(--riscv-light)))",
              }}
            />
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
              </div>
            )}
          </div>
          <div className="absolute bottom-0 left-10 top-0 w-1 md:hidden">
            <div
              className="absolute inset-0 rounded-full transition-all duration-[2000ms] ease-out"
              style={{
                height: visible ? "100%" : "0%",
                background:
                  "linear-gradient(to bottom, hsl(var(--brand) / 0.5), hsl(var(--riscv) / 0.7), hsl(var(--riscv-accent) / 0.6), hsl(var(--riscv) / 0.8), hsl(var(--riscv-light)))",
              }}
            />
          </div>

          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isLast = i === STEPS.length - 1;
            const delay = i * 300;
            const isActive = reduceMotion ? isLast : i === activeIndex;

            return (
              <div
                key={step.label}
                className="relative z-10 flex items-start gap-4 md:flex-1 md:flex-col md:items-center md:gap-3 md:px-2"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(24px)",
                  transition: `opacity 600ms ${delay}ms ease-out, transform 600ms ${delay}ms ease-out`,
                }}
              >
                <div className="relative shrink-0">
                  {isActive && visible && !reduceMotion && (
                    <div
                      className="pointer-events-none absolute left-1/2 top-1/2 h-[5.25rem] w-[5.25rem] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-riscv-accent/20 blur-lg motion-safe:animate-pulse"
                      aria-hidden
                    />
                  )}
                  <div
                    className={`group/icon relative flex h-20 w-20 items-center justify-center rounded-lg border-2 transition-all duration-700 ease-out ${
                      isActive
                        ? "z-10 scale-[1.04] border-riscv-accent bg-gradient-to-br from-riscv to-riscv-accent text-white shadow-[0_0_28px_hsl(var(--riscv-accent)/0.42)] ring-2 ring-riscv-accent/25"
                        : "z-10 border-border/70 bg-muted/40 text-riscv/50 shadow-none dark:border-border/50 dark:bg-muted/25"
                    }`}
                    style={{ transitionDelay: `${delay + 200}ms` }}
                  >
                    <Icon
                      className={`h-8 w-8 transition-transform duration-300 group-hover/icon:scale-110 ${
                        isActive ? "drop-shadow-[0_1px_3px_rgb(0_0_0_/_0.35)]" : ""
                      }`}
                      strokeWidth={isActive ? 2.35 : 1.65}
                    />
                  </div>
                </div>

                <div
                  className={`min-w-0 py-2 transition-opacity duration-500 md:text-center ${
                    isActive ? "" : "opacity-[0.82]"
                  }`}
                >
                  <p
                    className={`text-sm font-bold ${
                      isActive ? "text-foreground" : "text-foreground/50"
                    }`}
                  >
                    {step.label}
                  </p>
                  <p
                    className={`mt-0.5 text-xs leading-relaxed ${
                      isActive ? "text-muted-foreground" : "text-muted-foreground/60"
                    }`}
                  >
                    {step.detail}
                  </p>
                  <code
                    className={`mt-1.5 inline-block rounded px-2 py-0.5 font-mono text-[10px] ${
                      isActive
                        ? "bg-riscv-accent/[0.12] text-riscv-accent"
                        : "bg-muted/80 text-muted-foreground/80"
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
    </section>
  );
}
