"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  apiGenerateXsil,
  apiCheckOpcode,
  fetchPackages,
  ApiError,
  type WizardInstruction,
  type WizardInstructionFormat,
  type WizardInput,
} from "@/lib/api";
import {
  STANDARD_STATUS_INFO,
  STANDARD_STATUS_VALUES,
  type ExtensionConflict,
  type StandardStatus,
} from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Wand2,
  Plus,
  Trash2,
  Download,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

// Common RISC-V ISA strings, grouped by intent. Free-form input is still
// allowed (e.g. "RV64GC_Zicsr_Zifencei" or vendor extensions).
const ISA_GROUPS: { label: string; values: string[] }[] = [
  { label: "Base", values: ["RV32I", "RV64I", "RV32E", "RV64E"] },
  {
    label: "Common",
    values: [
      "RV32IM",
      "RV64IM",
      "RV32IMC",
      "RV64IMC",
      "RV32IMAC",
      "RV64IMAC",
      "RV32IMAFC",
      "RV64IMAFC",
    ],
  },
  {
    label: "General-purpose (G = IMAFD + Zicsr/Zifencei)",
    values: ["RV32GC", "RV64GC"],
  },
  {
    label: "With extensions",
    values: [
      "RV32GCV",
      "RV64GCV",
      "RV32GCB",
      "RV64GCB",
      "RV64GCH",
      "RV32GCK",
      "RV64GCK",
    ],
  },
];

const ISA_OPTIONS = ISA_GROUPS.flatMap((g) => g.values);

const LICENSES = [
  "Apache-2.0",
  "MIT",
  "GPL-2.0",
  "GPL-3.0",
  "LGPL-2.1",
  "LGPL-3.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "MPL-2.0",
  "CC-BY-4.0",
  "CC0-1.0",
  "Unlicense",
  "CERN-OHL-W-2.0",
  "CERN-OHL-S-2.0",
  "CERN-OHL-P-2.0",
];

const FORMATS: WizardInstructionFormat[] = ["R", "I", "S", "B", "U", "J"];

/** One-line description of each RISC-V instruction format, used for hints. */
const FORMAT_HINTS: Record<WizardInstructionFormat, string> = {
  R: "Register-register op (3 regs). Uses funct3 + funct7. Ex: add rd, rs1, rs2.",
  I: "Reg + 12-bit immediate. Uses funct3 (no funct7). Ex: addi rd, rs1, imm; lw.",
  S: "Store to memory. Uses funct3 (no funct7). Ex: sw rs2, off(rs1).",
  B: "Conditional branch. Uses funct3 (no funct7). Ex: beq rs1, rs2, label.",
  U: "20-bit upper immediate. No funct3/funct7. Ex: lui, auipc.",
  J: "Jump with 20-bit offset. No funct3/funct7. Ex: jal rd, label.",
};

/** Major opcodes reserved by the RISC-V ISA for non-standard custom extensions. */
const CUSTOM_OPCODES_HINT =
  "Major opcode (7 bits). Reserved for custom: custom-0 (0001011), custom-1 (0101011), custom-2 (1011011), custom-3 (1111011).";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

interface InstructionDraft extends WizardInstruction {
  id: string;
  operandsText: string;
}

type InstructionCollisionState = {
  loading: boolean;
  collides: boolean;
  conflicts: ExtensionConflict[];
  error?: string;
};

function newInstruction(): InstructionDraft {
  return {
    id: crypto.randomUUID(),
    mnemonic: "",
    format: "R",
    opcode: "",
    funct3: "",
    funct7: "",
    operandsText: "",
    summary: "",
  };
}

export default function WizardPage() {
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [version, setVersion] = useState("0.1.0");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [license, setLicense] = useState("Apache-2.0");
  const [isa, setIsa] = useState("RV64GC");
  const [repository, setRepository] = useState("");
  const [homepage, setHomepage] = useState("");
  const [standardStatus, setStandardStatus] = useState<StandardStatus>("custom");
  const [authority, setAuthority] = useState("");
  const [instructions, setInstructions] = useState<InstructionDraft[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [instructionCollisionMap, setInstructionCollisionMap] = useState<
    Record<string, InstructionCollisionState>
  >({});
  const [extensionSlugById, setExtensionSlugById] = useState<Record<string, string>>({});
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  // Pre-fill author with logged-in username, if any.
  useEffect(() => {
    if (user?.username && !author) setAuthor(user.username);
  }, [user, author]);

  const slug = slugify(name);
  const slugValid = slug.length >= 2;
  const semverOk = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version);
  // Repository is required and must be http(s).
  const repositoryTrimmed = repository.trim();
  const repositoryOk = (() => {
    if (!repositoryTrimmed) return false;
    try {
      const u = new URL(repositoryTrimmed);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  })();
  // Homepage stays optional, but if provided must be a valid http(s) URL.
  const homepageTrimmed = homepage.trim();
  const homepageOk =
    !homepageTrimmed ||
    (() => {
      try {
        const u = new URL(homepageTrimmed);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    })();
  const authorityTrimmed = authority.trim();
  const authorityOk =
    authorityTrimmed.length >= 2 && authorityTrimmed.length <= 200;
  const formValid =
    slugValid &&
    semverOk &&
    description.trim().length > 0 &&
    isa.length > 0 &&
    repositoryOk &&
    homepageOk &&
    authorityOk;

  const manifestPreview = useMemo(() => {
    return {
      name: slug || "your-extension",
      version: semverOk ? version : "0.1.0",
      description: description || "<one-line description>",
      author: author || user?.username || slug || "you",
      license,
      isa,
      readme: "README.md",
      keywords: ["risc-v", "extension", "xsil", "wizard"],
      repository: repositoryTrimmed || `https://github.com/${author || user?.username || "you"}/${slug || "your-extension"}`,
      ...(homepageTrimmed ? { homepage: homepageTrimmed } : {}),
      standardStatus,
      authority: authorityTrimmed || "<set authority>",
    };
  }, [
    slug,
    version,
    semverOk,
    description,
    author,
    user?.username,
    license,
    isa,
    repositoryTrimmed,
    homepageTrimmed,
    standardStatus,
    authorityTrimmed,
  ]);

  const fileTreePreview = useMemo(() => {
    const safeMnemonics = instructions
      .map((i) => i.mnemonic.trim())
      .filter(Boolean)
      .map((m) => m.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""))
      .filter(Boolean);
    return [
      "manifest.json",
      "README.md",
      "CHANGELOG.md",
      "LICENSE",
      "opcodes.json",
      "opcodes.h",
      "docs/overview.md",
      "examples/demo.S",
      ...safeMnemonics.map((m) => `examples/${m}.S`),
      ".xsilignore",
    ];
  }, [slug, instructions]);

  function patchInstruction(id: string, patch: Partial<InstructionDraft>) {
    setInstructions((prev) =>
      prev.map((ins) => (ins.id === id ? { ...ins, ...patch } : ins)),
    );
  }

  function removeInstruction(id: string) {
    setInstructions((prev) => prev.filter((ins) => ins.id !== id));
    setInstructionCollisionMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function parseIntegerLike(raw: string): number | null {
    const value = raw.trim().toLowerCase();
    if (!value) return null;
    if (/^0x[0-9a-f]+$/.test(value)) return Number.parseInt(value.slice(2), 16);
    if (/^0b[01]+$/.test(value)) return Number.parseInt(value.slice(2), 2);
    if (/^\d+$/.test(value)) return Number.parseInt(value, 10);
    return null;
  }

  function parseOpcodeInput(raw: string): number | null {
    const key = raw.trim().toLowerCase();
    if (!key) return null;
    if (key === "custom-0") return 0x0b;
    if (key === "custom-1") return 0x2b;
    if (key === "custom-2") return 0x5b;
    if (key === "custom-3") return 0x7b;
    const parsed = parseIntegerLike(raw);
    if (parsed == null || parsed < 0 || parsed > 0x7f) return null;
    return parsed;
  }

  function parseFunctInput(raw: string, bits: 3 | 7): number | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = parseIntegerLike(trimmed);
    if (parsed == null) return null;
    const max = bits === 3 ? 0b111 : 0b1111111;
    if (parsed < 0 || parsed > max) return null;
    return parsed;
  }

  function buildOpcodeCandidate(ins: InstructionDraft): {
    opcode: number;
    funct3?: number;
    funct7?: number;
    format: string;
  } | null {
    const opcode = parseOpcodeInput(ins.opcode ?? "");
    if (opcode == null) return null;
    const candidate: {
      opcode: number;
      funct3?: number;
      funct7?: number;
      format: string;
    } = { opcode, format: ins.format };

    if (ins.format !== "U" && ins.format !== "J") {
      const f3Raw = (ins.funct3 ?? "").trim();
      if (f3Raw) {
        const f3 = parseFunctInput(f3Raw, 3);
        if (f3 == null) return null;
        candidate.funct3 = f3;
      }
    }

    if (ins.format === "R") {
      const f7Raw = (ins.funct7 ?? "").trim();
      if (f7Raw) {
        const f7 = parseFunctInput(f7Raw, 7);
        if (f7 == null) return null;
        candidate.funct7 = f7;
      }
    }

    return candidate;
  }

  useEffect(() => {
    const timers: number[] = [];
    const validIds = new Set(instructions.map((ins) => ins.id));
    setInstructionCollisionMap((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (!validIds.has(id)) delete next[id];
      }
      return next;
    });

    for (const ins of instructions) {
      const candidate = buildOpcodeCandidate(ins);
      if (!candidate) {
        setInstructionCollisionMap((prev) => {
          if (!prev[ins.id]) return prev;
          return {
            ...prev,
            [ins.id]: { loading: false, collides: false, conflicts: [] },
          };
        });
        continue;
      }

      setInstructionCollisionMap((prev) => ({
        ...prev,
        [ins.id]: {
          loading: true,
          collides: prev[ins.id]?.collides ?? false,
          conflicts: prev[ins.id]?.conflicts ?? [],
        },
      }));

      const timer = window.setTimeout(async () => {
        try {
          const response = await apiCheckOpcode(candidate);
          setInstructionCollisionMap((prev) => ({
            ...prev,
            [ins.id]: {
              loading: false,
              collides: response.collides,
              conflicts: response.conflicts,
            },
          }));
        } catch (err) {
          setInstructionCollisionMap((prev) => ({
            ...prev,
            [ins.id]: {
              loading: false,
              collides: false,
              conflicts: [],
              error:
                err instanceof ApiError
                  ? err.message
                  : "Could not validate encoding collision.",
            },
          }));
        }
      }, 450);
      timers.push(timer);
    }

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [instructions]);

  useEffect(() => {
    if (catalogLoaded) return;
    const unknownIds = new Set<string>();
    for (const row of Object.values(instructionCollisionMap)) {
      for (const c of row.conflicts) {
        if (!extensionSlugById[c.withExtensionId]) unknownIds.add(c.withExtensionId);
      }
    }
    if (unknownIds.size === 0) return;

    let cancelled = false;
    fetchPackages({ limit: 500 })
      .then((rows) => {
        if (cancelled) return;
        setExtensionSlugById(Object.fromEntries(rows.map((p) => [String(p.id), p.slug])));
        setCatalogLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setCatalogLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [instructionCollisionMap, extensionSlugById, catalogLoaded]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!formValid || busy) return;
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const input: WizardInput = {
        name: slug,
        version,
        description: description.trim(),
        author: author.trim() || undefined,
        license: license || undefined,
        isa,
        repository: repositoryTrimmed,
        homepage: homepageTrimmed || undefined,
        standardStatus,
        authority: authorityTrimmed,
        instructions: instructions.map((ins) => ({
          mnemonic: ins.mnemonic.trim(),
          format: ins.format,
          opcode: ins.opcode?.trim() || undefined,
          funct3: ins.funct3?.trim() || undefined,
          funct7: ins.funct7?.trim() || undefined,
          operands: ins.operandsText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          summary: ins.summary?.trim() || undefined,
        })),
        targets: {},
      };

      const { blob, filename } = await apiGenerateXsil(input);
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        // Revoke after a short delay so the browser can finish the download attach.
        setTimeout(() => URL.revokeObjectURL(url), 5_000);
      }
      setSuccess(`Generated ${filename}. Unpack it and run \`xsil run ${slug}\`.`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to generate the .xsil skeleton.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container max-w-5xl px-4 py-10">
      <Link
        href="/"
        className="-ml-1 mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Registry
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-2">
          <Wand2 className="h-6 w-6" aria-hidden />
          <h1 className="text-2xl font-bold">Extension Wizard</h1>
          <Badge variant="secondary">beta</Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Describe the architectural intent and download an{" "}
          <code className="font-mono text-xs">.xsil</code> Extension definition with
          encoding metadata, documentation, and examples. No Target support is claimed.
        </p>
      </div>

      <form onSubmit={handleGenerate} className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          {/* 1. Identity */}
          <section className="space-y-4 rounded-lg border bg-card p-6">
            <header>
              <h2 className="text-base font-semibold">1. Identity</h2>
              <p className="text-xs text-muted-foreground">
                Slug becomes the package id. Display fields land in{" "}
                <code className="font-mono">manifest.json</code>.
              </p>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Extension name"
                htmlFor="wiz-name"
                required
                hint={
                  slug
                    ? `slug: @${slug}`
                    : "Lowercase letters, digits, and hyphens"
                }
              >
                <Input
                  id="wiz-name"
                  placeholder="my-extension"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Field>

              <Field
                label="Version"
                htmlFor="wiz-version"
                required
                hint="Semver, e.g. 0.1.0"
                error={version && !semverOk ? "Not a valid semver." : undefined}
              >
                <Input
                  id="wiz-version"
                  placeholder="0.1.0"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Description" htmlFor="wiz-desc" required hint="Up to 280 characters.">
              <Textarea
                id="wiz-desc"
                placeholder="What does this extension do?"
                rows={2}
                maxLength={280}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Author" htmlFor="wiz-author" hint="Defaults to your username when logged in.">
                <Input
                  id="wiz-author"
                  placeholder="your-username"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
              </Field>

              <Field label="License" htmlFor="wiz-license">
                <select
                  id="wiz-license"
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {LICENSES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Repository URL"
                htmlFor="wiz-repo"
                required
                hint="Where the source will live. Use a placeholder URL if the repo is not created yet."
                error={
                  repositoryTrimmed && !repositoryOk
                    ? "Must be a valid http(s) URL."
                    : undefined
                }
              >
                <Input
                  id="wiz-repo"
                  type="url"
                  placeholder="https://github.com/you/my-extension"
                  value={repository}
                  onChange={(e) => setRepository(e.target.value)}
                  required
                />
              </Field>
              <Field
                label="Homepage URL"
                htmlFor="wiz-home"
                hint="Optional."
                error={
                  homepageTrimmed && !homepageOk
                    ? "Must be a valid http(s) URL."
                    : undefined
                }
              >
                <Input
                  id="wiz-home"
                  type="url"
                  placeholder="https://example.com"
                  value={homepage}
                  onChange={(e) => setHomepage(e.target.value)}
                />
              </Field>
            </div>

            <div className="rounded-md border border-amber-200/60 bg-amber-50/50 p-4 text-xs leading-relaxed text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="font-semibold">Honest classification (required)</p>
              <p className="mt-1 opacity-90">
                Tell the registry where this extension stands relative to the
                RISC-V standard. We display it on the package page and use it to
                group the catalog. Don&apos;t mark something <em>ratified</em>{" "}
                unless RISC-V International has actually frozen the spec.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Standard status"
                htmlFor="wiz-status"
                required
                hint={STANDARD_STATUS_INFO[standardStatus].description}
              >
                <select
                  id="wiz-status"
                  value={standardStatus}
                  onChange={(e) => {
                    const next = e.target.value as StandardStatus;
                    setStandardStatus(next);
                    if (next === "ratified" && !authority.trim()) {
                      setAuthority("RISC-V International");
                    }
                  }}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {STANDARD_STATUS_VALUES.map((s) => (
                    <option key={s} value={s}>
                      {STANDARD_STATUS_INFO[s].label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Authority"
                htmlFor="wiz-authority"
                required
                hint='Who defines the spec? e.g. "RISC-V International", "T-Head / XuanTie", "University of Michigan".'
                error={
                  authorityTrimmed.length > 0 && !authorityOk
                    ? "Authority must be 2–200 characters."
                    : undefined
                }
              >
                <Input
                  id="wiz-authority"
                  type="text"
                  maxLength={200}
                  placeholder={
                    standardStatus === "ratified"
                      ? "RISC-V International"
                      : standardStatus === "vendor"
                        ? "T-Head / XuanTie"
                        : "University / company / individual"
                  }
                  value={authority}
                  onChange={(e) => setAuthority(e.target.value)}
                  required
                />
              </Field>
            </div>
          </section>

          {/* 2. ISA */}
          <section className="space-y-4 rounded-lg border bg-card p-6">
            <header>
              <h2 className="text-base font-semibold">2. ISA</h2>
              <p className="text-xs text-muted-foreground">
                Base ISA required by the extension. Stored as the architectural{" "}
                <code className="font-mono">manifest.isa</code> dependency. Pick a preset or
                type your own (e.g.{" "}
                <code className="font-mono">RV64GC_Zicsr_Zifencei</code>).
              </p>
            </header>

            <Field
              label="Base ISA"
              htmlFor="wiz-isa"
              required
              hint={
                ISA_OPTIONS.includes(isa)
                  ? undefined
                  : "Custom ISA string — make sure your simulator accepts it."
              }
            >
              <Input
                id="wiz-isa"
                list="wiz-isa-options"
                value={isa}
                onChange={(e) => setIsa(e.target.value.toUpperCase())}
              />
              <datalist id="wiz-isa-options">
                {ISA_OPTIONS.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </Field>

            <div className="space-y-3">
              {ISA_GROUPS.map((group) => (
                <div key={group.label} className="space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.values.map((opt) => {
                      const active = isa === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setIsa(opt)}
                          aria-pressed={active}
                          className={
                            "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors " +
                            (active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background hover:bg-accent hover:text-accent-foreground")
                          }
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Custom instructions */}
          <section className="space-y-4 rounded-lg border bg-card p-6">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">3. Custom instructions</h2>
                <p className="text-xs text-muted-foreground">
                  Optional. Listed in{" "}
                  <code className="font-mono">opcodes.json</code> and the README.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  setInstructions((prev) => [...prev, newInstruction()])
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add instruction
              </Button>
            </header>

            <details className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">
                What are format / funct3 / funct7?
              </summary>
              <div className="mt-3 space-y-2 leading-relaxed">
                <p>
                  RISC-V encodes every instruction in 32 bits. The{" "}
                  <strong>format</strong> picks how those bits are split into
                  fields. The most common formats for custom ops are:
                </p>
                <ul className="ml-4 list-disc space-y-0.5">
                  <li>
                    <strong>R</strong> — 3 registers (
                    <code className="font-mono">add rd, rs1, rs2</code>). Uses{" "}
                    <strong>funct3</strong> and <strong>funct7</strong>.
                  </li>
                  <li>
                    <strong>I</strong> — 1 reg + 12-bit immediate (
                    <code className="font-mono">addi rd, rs1, imm</code>,{" "}
                    <code className="font-mono">lw</code>). Uses{" "}
                    <strong>funct3</strong> only.
                  </li>
                  <li>
                    <strong>S</strong> — store (
                    <code className="font-mono">sw rs2, off(rs1)</code>).{" "}
                    <strong>funct3</strong> only.
                  </li>
                  <li>
                    <strong>B</strong> — conditional branch (
                    <code className="font-mono">beq</code>).{" "}
                    <strong>funct3</strong> only.
                  </li>
                  <li>
                    <strong>U</strong> — 20-bit upper immediate (
                    <code className="font-mono">lui</code>,{" "}
                    <code className="font-mono">auipc</code>). No funct3/funct7.
                  </li>
                  <li>
                    <strong>J</strong> — jump with 20-bit offset (
                    <code className="font-mono">jal</code>). No funct3/funct7.
                  </li>
                </ul>
                <p>
                  <strong>opcode</strong> is the 7-bit major opcode that picks
                  the family of operations. RISC-V reserves 4 majors for
                  non-standard extensions:{" "}
                  <code className="font-mono">custom-0 (0001011)</code>,{" "}
                  <code className="font-mono">custom-1 (0101011)</code>,{" "}
                  <code className="font-mono">custom-2 (1011011)</code>,{" "}
                  <code className="font-mono">custom-3 (1111011)</code>.
                </p>
                <p>
                  <strong>funct3</strong> (3 bits) and <strong>funct7</strong>{" "}
                  (7 bits) sub-divide instructions sharing the same opcode. Ex:
                  <code className="ml-1 font-mono">add</code> and{" "}
                  <code className="font-mono">sub</code> both use opcode{" "}
                  <code className="font-mono">0110011</code>, funct3{" "}
                  <code className="font-mono">000</code>; the difference is
                  funct7 (
                  <code className="font-mono">0000000</code> vs{" "}
                  <code className="font-mono">0100000</code>).
                </p>
                <p>
                  <strong>summary</strong> is plain English (e.g.{" "}
                  <code className="font-mono">rd = rs1 + rs2</code>) — purely
                  informational, surfaced in the README and{" "}
                  <code className="font-mono">opcodes.json</code>. It does not
                  affect encoding.
                </p>
              </div>
            </details>

            {instructions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No instructions yet — a placeholder will be added to{" "}
                <code className="font-mono">opcodes.json</code>.
              </p>
            ) : (
              <div className="space-y-4">
                {instructions.map((ins, idx) => (
                  <div
                    key={ins.id}
                    className="space-y-3 rounded-md border bg-background p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Instruction #{idx + 1}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeInstruction(ins.id)}
                        aria-label="Remove instruction"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <Field
                        label="Mnemonic"
                        htmlFor={`ins-mn-${ins.id}`}
                        required
                        hint="Assembly name, e.g. x.cust1, dot.product, sat.add."
                      >
                        <Input
                          id={`ins-mn-${ins.id}`}
                          placeholder="x.cust1"
                          value={ins.mnemonic}
                          onChange={(e) =>
                            patchInstruction(ins.id, { mnemonic: e.target.value })
                          }
                        />
                      </Field>
                      <Field
                        label="Format"
                        htmlFor={`ins-fmt-${ins.id}`}
                        required
                        hint={FORMAT_HINTS[ins.format]}
                      >
                        <select
                          id={`ins-fmt-${ins.id}`}
                          value={ins.format}
                          onChange={(e) =>
                            patchInstruction(ins.id, {
                              format: e.target.value as WizardInstructionFormat,
                            })
                          }
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {FORMATS.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <Field
                        label="Opcode"
                        htmlFor={`ins-op-${ins.id}`}
                        hint={CUSTOM_OPCODES_HINT}
                      >
                        <Input
                          id={`ins-op-${ins.id}`}
                          placeholder="custom-0"
                          value={ins.opcode ?? ""}
                          onChange={(e) =>
                            patchInstruction(ins.id, { opcode: e.target.value })
                          }
                        />
                      </Field>
                      <Field
                        label="funct3"
                        htmlFor={`ins-f3-${ins.id}`}
                        hint={
                          ins.format === "U" || ins.format === "J"
                            ? `Not used by ${ins.format}-type — leave blank.`
                            : "3-bit sub-op (binary, e.g. 0b000)."
                        }
                      >
                        <Input
                          id={`ins-f3-${ins.id}`}
                          placeholder="0b000"
                          value={ins.funct3 ?? ""}
                          onChange={(e) =>
                            patchInstruction(ins.id, { funct3: e.target.value })
                          }
                          disabled={ins.format === "U" || ins.format === "J"}
                        />
                      </Field>
                      <Field
                        label="funct7"
                        htmlFor={`ins-f7-${ins.id}`}
                        hint={
                          ins.format === "R"
                            ? "7-bit sub-op for R-type (e.g. 0b0000000 ADD vs 0b0100000 SUB)."
                            : `Only used by R-type — leave blank for ${ins.format}-type.`
                        }
                      >
                        <Input
                          id={`ins-f7-${ins.id}`}
                          placeholder="0b0000000"
                          value={ins.funct7 ?? ""}
                          onChange={(e) =>
                            patchInstruction(ins.id, { funct7: e.target.value })
                          }
                          disabled={ins.format !== "R"}
                        />
                      </Field>
                    </div>

                    {instructionCollisionMap[ins.id]?.loading && (
                      <p className="text-xs text-muted-foreground">
                        Checking encoding collisions...
                      </p>
                    )}

                    {!instructionCollisionMap[ins.id]?.loading &&
                      instructionCollisionMap[ins.id]?.conflicts?.length > 0 && (
                        <div className="space-y-2">
                          {instructionCollisionMap[ins.id].conflicts.map((conflict, conflictIdx) => {
                            const slug = extensionSlugById[conflict.withExtensionId];
                            const targetName = slug ? (
                              <Link href={`/package/${slug}`} className="underline underline-offset-2">
                                {conflict.withExtensionName}
                              </Link>
                            ) : (
                              <span>{conflict.withExtensionName}</span>
                            );
                            if (conflict.severity === "FATAL") {
                              return (
                                <Alert
                                  key={`${ins.id}-fatal-${conflictIdx}`}
                                  variant="destructive"
                                  className="py-2"
                                >
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription className="text-xs">
                                    This encoding is already claimed by {targetName} ({conflict.detail}). Consider a different opcode.
                                  </AlertDescription>
                                </Alert>
                              );
                            }
                            return (
                              <Alert
                                key={`${ins.id}-warn-${conflictIdx}`}
                                className="border-amber-500/50 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 py-2"
                              >
                                <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                                <AlertDescription className="text-xs">
                                  This encoding overlaps with {targetName}. This may be resolvable by remapping, but flagging it now.
                                </AlertDescription>
                              </Alert>
                            );
                          })}
                        </div>
                      )}

                    {instructionCollisionMap[ins.id]?.error && (
                      <p className="text-xs text-muted-foreground">
                        {instructionCollisionMap[ins.id].error}
                      </p>
                    )}

                    <Field
                      label="Operands"
                      htmlFor={`ins-oa-${ins.id}`}
                      hint="Comma-separated assembly operands, e.g. rd, rs1, rs2 (or rd, rs1, imm for I-type)."
                    >
                      <Input
                        id={`ins-oa-${ins.id}`}
                        placeholder="rd, rs1, rs2"
                        value={ins.operandsText}
                        onChange={(e) =>
                          patchInstruction(ins.id, { operandsText: e.target.value })
                        }
                      />
                    </Field>

                    <Field
                      label="Summary"
                      htmlFor={`ins-sm-${ins.id}`}
                      hint="Plain-English description (informational only). Lands in README + opcodes.json."
                    >
                      <Input
                        id={`ins-sm-${ins.id}`}
                        placeholder="rd = rs1 + rs2"
                        value={ins.summary ?? ""}
                        onChange={(e) =>
                          patchInstruction(ins.id, { summary: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Errors / success / submit */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Could not generate</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Done</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!formValid || busy} className="gap-2">
              <Download className="h-4 w-4" />
              {busy ? "Generating…" : `Generate .xsil`}
            </Button>
            <p className="text-xs text-muted-foreground">
              The download is a tar+gzip archive. Unpack with{" "}
              <code className="font-mono">tar -xzf</code> or open the folder
              produced by <code className="font-mono">xsil install</code>.
            </p>
          </div>
        </div>

        {/* Sidebar preview */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-lg border bg-card p-4">
            <header className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Files</h3>
              <Badge variant="outline">{fileTreePreview.length}</Badge>
            </header>
            <ul className="space-y-1 font-mono text-xs text-muted-foreground">
              {fileTreePreview.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-lg border bg-card p-4">
            <header className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">manifest.json (preview)</h3>
            </header>
            <pre className="max-h-[400px] overflow-auto rounded bg-muted/50 p-3 font-mono text-[11px] leading-relaxed">
              {JSON.stringify(manifestPreview, null, 2)}
            </pre>
          </section>
        </aside>
      </form>
    </div>
  );
}
