"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

const CHAR_MS = 26;
const OUTPUT_STAGGER_MS = 130;
const SCENE_PAUSE_MS = 420;
const LOOP_PAUSE_MS = 2200;

type CommandLine = {
  kind: "command";
  text: string;
  comment?: string;
  setup?: boolean;
};

type OutputLine = {
  kind: "output" | "success";
  text: string;
};

type DividerLine = { kind: "divider" };

export type TerminalLine = CommandLine | OutputLine | DividerLine;

type TypingState = {
  text: string;
  revealed: number;
  comment?: string;
  setup?: boolean;
};

const FINAL_LINES: TerminalLine[] = [
  { kind: "command", text: "cargo install xsil", comment: "one-time", setup: true },
  { kind: "output", text: "    Installing xsil v0.2.3 …" },
  { kind: "success", text: "    Installed xsil v0.2.3" },
  { kind: "divider" },
  { kind: "command", text: "xsil install rvx-demo" },
  { kind: "output", text: "    Resolving rvx-demo@latest …" },
  { kind: "output", text: "    Downloaded rvx-demo-1.0.0.xsil (sha256 verified)" },
  { kind: "success", text: "    Ready — run: xsil run rvx-demo" },
  { kind: "divider" },
  { kind: "command", text: "xsil run rvx-demo" },
  { kind: "output", text: "    [sim] spike --isa=rv64gc +rvv …" },
  { kind: "success", text: "    PASS  examples/demo.S (3 cycles)" },
];

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

function useInView(ref: RefObject<HTMLElement | null>, threshold = 0.25) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, threshold]);
  return visible;
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort);
  });
}

function TerminalLineView({ line }: { line: TerminalLine }) {
  if (line.kind === "divider") {
    return <div className="my-1.5 h-px bg-white/5" aria-hidden />;
  }
  if (line.kind === "command") {
    return (
      <p className="leading-8 tracking-tight sm:leading-9">
        <span className="select-none font-medium text-emerald-400/95">$ </span>
        <span className={line.setup ? "text-amber-200/95" : "text-[#f1f5f9]"}>
          {line.text}
        </span>
        {line.comment ? (
          <span className="ml-3 select-none text-[#9aa6b8]"># {line.comment}</span>
        ) : null}
      </p>
    );
  }
  return (
    <p
      className={
        line.kind === "success"
          ? "leading-7 text-emerald-300/90 sm:leading-8"
          : "leading-7 text-[#9aa6b8] sm:leading-8"
      }
    >
      {line.text}
    </p>
  );
}

/** Fits the full quickstart transcript so the hero layout never grows mid-animation. */
const TERMINAL_BODY_CLASS =
  "h-[23.5rem] overflow-hidden bg-[hsl(222_32%_7%)] px-5 py-5 text-[#e8edf5] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04)] dark:bg-[hsl(222_38%_5%)] dark:text-[#eef2f8] sm:h-[24.5rem] sm:px-6 sm:py-6";

export function HeroTerminal() {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef);
  const reduceMotion = usePrefersReducedMotion();
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [typing, setTyping] = useState<TypingState | null>(null);
  const [cursorOn, setCursorOn] = useState(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines, typing]);

  const runScene = useCallback(async (signal: AbortSignal) => {
    const typeCommand = async (
      text: string,
      opts?: { comment?: string; setup?: boolean },
    ) => {
      setTyping({ text, revealed: 0, ...opts });
      for (let i = 1; i <= text.length; i++) {
        await sleep(CHAR_MS, signal);
        setTyping({ text, revealed: i, ...opts });
      }
      setLines((prev) => [
        ...prev,
        { kind: "command", text, comment: opts?.comment, setup: opts?.setup },
      ]);
      setTyping(null);
      await sleep(SCENE_PAUSE_MS, signal);
    };

    const appendOutputs = async (outputs: OutputLine[]) => {
      for (const out of outputs) {
        await sleep(OUTPUT_STAGGER_MS, signal);
        setLines((prev) => [...prev, out]);
      }
      await sleep(SCENE_PAUSE_MS, signal);
    };

    const appendDivider = async () => {
      setLines((prev) => [...prev, { kind: "divider" }]);
      await sleep(Math.round(SCENE_PAUSE_MS * 0.6), signal);
    };

    setLines([]);
    setTyping(null);

    await typeCommand("cargo install xsil", { comment: "one-time", setup: true });
    await appendOutputs([
      { kind: "output", text: "    Installing xsil v0.2.3 …" },
      { kind: "success", text: "    Installed xsil v0.2.3" },
    ]);
    await appendDivider();

    await typeCommand("xsil install rvx-demo");
    await appendOutputs([
      { kind: "output", text: "    Resolving rvx-demo@latest …" },
      {
        kind: "output",
        text: "    Downloaded rvx-demo-1.0.0.xsil (sha256 verified)",
      },
      { kind: "success", text: "    Ready — run: xsil run rvx-demo" },
    ]);
    await appendDivider();

    await typeCommand("xsil run rvx-demo");
    await appendOutputs([
      { kind: "output", text: "    [sim] spike --isa=rv64gc +rvv …" },
      { kind: "success", text: "    PASS  examples/demo.S (3 cycles)" },
    ]);

    await sleep(LOOP_PAUSE_MS, signal);
  }, []);

  useEffect(() => {
    if (!inView) return;
    if (reduceMotion) {
      setLines(FINAL_LINES);
      setTyping(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const blink = window.setInterval(() => {
      setCursorOn((on) => !on);
    }, 530);

    (async () => {
      while (!cancelled) {
        try {
          await runScene(controller.signal);
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") break;
          throw err;
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(blink);
    };
  }, [inView, reduceMotion, runScene]);

  const showCursor = !reduceMotion && typing !== null && cursorOn;

  return (
    <div
      ref={rootRef}
      className="relative"
      aria-label="Animated terminal demo: install xsil, install rvx-demo, and run it"
    >
      <div
        className="pointer-events-none absolute -inset-1 rounded-2xl opacity-70 blur-md sm:-inset-1.5"
        style={{
          background:
            "linear-gradient(145deg, hsl(var(--riscv-accent) / 0.22), transparent 42%, hsl(var(--riscv) / 0.12))",
        }}
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-xl border border-border/90 text-left font-mono text-[0.9375rem] leading-relaxed shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.2),0_20px_50px_-12px_rgb(0_0_0_/_0.45),0_0_0_1px_rgb(0_0_0_/_0.08)] ring-1 ring-riscv-accent/25 ring-offset-2 ring-offset-[hsl(222_32%_97%)] transition-all duration-200 ease-out will-change-transform hover:-translate-y-0.5 hover:border-riscv-accent/45 hover:shadow-[0_8px_12px_-2px_rgb(0_0_0_/_0.22),0_24px_56px_-12px_rgb(0_0_0_/_0.48)] dark:border-border/60 dark:ring-riscv-accent/20 dark:ring-offset-background dark:hover:border-riscv-accent/35 sm:text-base sm:leading-relaxed">
        <div className="flex items-center gap-2 border-b border-white/10 bg-muted/85 px-5 py-2.5 dark:border-white/5 dark:bg-muted/50">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-400/75 shadow-[0_0_8px_rgb(248_113_113_/_0.35)]" />
            <span className="h-3 w-3 rounded-full bg-amber-400/75 shadow-[0_0_8px_rgb(251_191_36_/_0.3)]" />
            <span className="h-3 w-3 rounded-full bg-emerald-400/70 shadow-[0_0_8px_rgb(52_211_153_/_0.3)]" />
          </div>
          <p className="ml-1 select-none text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
            quickstart — xsil
          </p>
        </div>
        <div className={TERMINAL_BODY_CLASS} aria-live={reduceMotion ? "off" : "polite"}>
          <div
            ref={scrollRef}
            className="h-full overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex min-h-full flex-col justify-end">
              {lines.map((line, i) => (
                <TerminalLineView key={`${line.kind}-${i}`} line={line} />
              ))}
              {typing ? (
                <p className="leading-8 tracking-tight sm:leading-9">
                  <span className="select-none font-medium text-emerald-400/95">$ </span>
                  <span
                    className={typing.setup ? "text-amber-200/95" : "text-[#f1f5f9]"}
                  >
                    {typing.text.slice(0, typing.revealed)}
                  </span>
                  {typing.comment && typing.revealed >= typing.text.length ? (
                    <span className="ml-3 select-none text-[#9aa6b8]">
                      # {typing.comment}
                    </span>
                  ) : null}
                  <span
                    className={`ml-0.5 inline-block h-[1.05em] w-[0.55em] translate-y-[0.12em] bg-emerald-400/90 ${
                      showCursor ? "opacity-100" : "opacity-0"
                    }`}
                    aria-hidden
                  />
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
