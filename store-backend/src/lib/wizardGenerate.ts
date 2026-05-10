/**
 * Build a runnable `.xsil` skeleton in memory from a wizard-style input.
 *
 * The output is a gzip-compressed tar (the same format produced by `xsil publish`),
 * so the resulting archive is accepted by `validatePublishedXsilBuffer` and by the
 * registry's `POST /packages/:name/versions` endpoint.
 *
 * Notes for maintainers:
 *  - The payload hash is computed over the SHA-256 of every non-`manifest.json`
 *    file, in lexicographic POSIX path order, matching `computePayloadHashFromDir`
 *    and the Rust CLI (`ExtensionManager::compute_payload_hash`).
 *  - Templates are intentionally inline and short. The skeleton is valid for
 *    `xsil publish` (CLI/server) but the contents are placeholders the author
 *    is expected to flesh out.
 */
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import * as tar from 'tar-stream';
import ignore from 'ignore';
import * as semver from 'semver';
import {
  normalizeStandardStatus,
  STANDARD_STATUS_VALUES,
  type StandardStatus,
  AUTHORITY_MAX,
  AUTHORITY_MIN,
} from './standardStatus';

/**
 * Same built-in ignore list as `xsilPublishValidate.ts` (`BUILTIN_IGNORE_BLOCK`)
 * and the Rust CLI (`IgnoreRules::BUILTIN`). Files matching these patterns are
 * still placed in the tar archive (so they round-trip on extract) but they are
 * excluded from the SHA-256 payload hash, identical to how `xsil publish`
 * computes it.
 */
const BUILTIN_IGNORE_BLOCK = ['.git/', '.xsilignore', '.DS_Store', 'Thumbs.db'].join('\n');

// ── Public input/output shapes ─────────────────────────────────────────────────

export type WizardInstructionFormat = 'R' | 'I' | 'S' | 'B' | 'U' | 'J';

export interface WizardInstruction {
  /** Mnemonic, e.g. "x.cust1". 1..32 chars, lower/upper letters, digits, '.', '_'. */
  mnemonic: string;
  /** RISC-V format. */
  format: WizardInstructionFormat;
  /** Free-form opcode hint, e.g. "custom-0" or "0b0001011". */
  opcode?: string;
  /** Free-form funct3, e.g. "0b000". */
  funct3?: string;
  /** Free-form funct7, e.g. "0b0000000". */
  funct7?: string;
  /** Operand list, e.g. ["rd", "rs1", "rs2"]. */
  operands?: string[];
  /** One-line summary (what the instruction does, in plain words). */
  summary?: string;
}

export interface WizardTargetsInput {
  /** Always generated (the only fully wired skeleton). */
  spike?: boolean;
  /** Listed as `status: planned`. */
  qemu?: boolean;
  /** Listed as `status: planned`. */
  binutils?: boolean;
  /** Listed as `status: planned`. */
  llvm?: boolean;
}

export interface WizardInput {
  name: string;
  version?: string;
  description: string;
  author?: string;
  license?: string;
  isa?: string;
  /** Required repository URL (http or https). Surfaced in manifest + README. */
  repository: string;
  /** Optional homepage URL (http or https). */
  homepage?: string;
  /**
   * Required honest classification: ratified | draft | vendor | research | custom.
   * Surfaced as `manifest.standardStatus`. See docs/catalog-seed/catalog.md.
   */
  standardStatus: StandardStatus;
  /**
   * Required free-text spec authority (e.g. "RISC-V International", "T-Head /
   * XuanTie", "Qualcomm"). Surfaced as `manifest.authority`.
   */
  authority: string;
  instructions?: WizardInstruction[];
  targets?: WizardTargetsInput;
}

export interface GenerateXsilResult {
  buffer: Buffer;
  /** Suggested filename (`<slug>-<version>.xsil`). */
  filename: string;
  /** Resolved package slug (lower-cased). */
  slug: string;
  /** Resolved semver string. */
  version: string;
  /** SHA-256 over payload, formatted `sha256:<hex>` (matches Version.checksumPayload). */
  payloadChecksum: string;
}

// ── Validation ─────────────────────────────────────────────────────────────────

/** Aligns with `packagesController.SLUG_RE`. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]{1,2}$/;
const NAME_MIN = 2;
const NAME_MAX = 64;

/** Aligns with `packagesController.RESERVED_NAMES`. */
const RESERVED_NAMES = new Set<string>([
  'xsil', 'extensilica', 'registry', 'store', 'platform',
  'admin', 'administrator', 'root', 'system', 'superuser', 'sudo',
  'moderator', 'staff', 'support', 'official', 'security',
  'test', 'testing', 'demo', 'example', 'sample', 'placeholder',
  'undefined', 'null', 'none', 'noop', 'empty', 'blank',
  'todo', 'fixme', 'temp', 'tmp',
  'lib', 'core', 'base', 'common', 'utils', 'util', 'tools',
  'api', 'sdk', 'cli', 'app', 'pkg', 'package',
  'v1', 'v2', 'v3',
]);

const MNEMONIC_RE = /^[A-Za-z][A-Za-z0-9._]{0,31}$/;
const ISA_RE = /^[A-Z0-9_]{2,40}$/;
const ALLOWED_FORMATS: ReadonlySet<WizardInstructionFormat> = new Set(['R', 'I', 'S', 'B', 'U', 'J']);

const DESCRIPTION_MAX = 280;
const AUTHOR_MAX = 80;
const LICENSE_MAX = 64;
const URL_MAX = 2048;
const MAX_INSTRUCTIONS = 32;

export class WizardInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WizardInputError';
  }
}

function trim(s: unknown, max: number): string {
  if (typeof s !== 'string') return '';
  const t = s.trim();
  return t.length > max ? t.slice(0, max) : t;
}

function ensureHttpsOrEmpty(field: string, raw: string | undefined): string {
  if (!raw) return '';
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new WizardInputError(`${field} must be a valid URL.`);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new WizardInputError(`${field} must be http or https.`);
  }
  return u.toString();
}

function normalizeWizardInput(raw: WizardInput): {
  slug: string;
  version: string;
  description: string;
  author: string;
  license: string;
  isa: string;
  repository: string;
  homepage: string;
  standardStatus: StandardStatus;
  authority: string;
  instructions: WizardInstruction[];
  targets: Required<WizardTargetsInput>;
} {
  const slug = trim(raw.name, NAME_MAX).toLowerCase();
  if (!slug) throw new WizardInputError('name is required.');
  if (slug.length < NAME_MIN) throw new WizardInputError(`name must be at least ${NAME_MIN} characters.`);
  if (!SLUG_RE.test(slug)) {
    throw new WizardInputError(
      'name may only contain lowercase letters, digits, and hyphens, and must start and end with a letter or digit.',
    );
  }
  if (RESERVED_NAMES.has(slug)) {
    throw new WizardInputError(`"${slug}" is a reserved name and cannot be used for a package.`);
  }

  const versionRaw = trim(raw.version, 64) || '0.1.0';
  if (!semver.valid(versionRaw)) {
    throw new WizardInputError(`version "${versionRaw}" is not valid semver (e.g. 0.1.0).`);
  }

  const description = trim(raw.description, DESCRIPTION_MAX);
  if (!description) throw new WizardInputError('description is required.');

  const author = trim(raw.author, AUTHOR_MAX) || slug;
  const license = trim(raw.license, LICENSE_MAX) || 'Apache-2.0';

  const isaRaw = (trim(raw.isa, 40) || 'RV64GC').toUpperCase();
  if (!ISA_RE.test(isaRaw)) {
    throw new WizardInputError('isa must be 2..40 chars (A-Z, 0-9, _), e.g. RV64GC.');
  }

  const repositoryRaw = trim(raw.repository, URL_MAX);
  if (!repositoryRaw) {
    throw new WizardInputError('repository is required (use the future repo URL if it does not exist yet).');
  }
  const repository = ensureHttpsOrEmpty('repository', repositoryRaw);
  const homepage = ensureHttpsOrEmpty('homepage', trim(raw.homepage, URL_MAX) || undefined);

  // Honest classification — both fields are mandatory now.
  const standardStatus = normalizeStandardStatus(raw.standardStatus);
  if (standardStatus === null) {
    throw new WizardInputError(
      `standardStatus is required and must be one of: ${STANDARD_STATUS_VALUES.join(', ')}.`,
    );
  }
  const authorityRaw = trim(raw.authority, AUTHORITY_MAX);
  if (!authorityRaw) {
    throw new WizardInputError('authority is required (e.g. "RISC-V International", "T-Head / XuanTie").');
  }
  if (authorityRaw.length < AUTHORITY_MIN) {
    throw new WizardInputError(`authority must be at least ${AUTHORITY_MIN} character.`);
  }

  const instructionsIn = Array.isArray(raw.instructions) ? raw.instructions : [];
  if (instructionsIn.length > MAX_INSTRUCTIONS) {
    throw new WizardInputError(`Too many instructions (max ${MAX_INSTRUCTIONS}).`);
  }
  const instructions: WizardInstruction[] = [];
  for (let i = 0; i < instructionsIn.length; i++) {
    const ins = instructionsIn[i] ?? ({} as WizardInstruction);
    const mnemonic = trim(ins.mnemonic, 32);
    if (!mnemonic) throw new WizardInputError(`instructions[${i}].mnemonic is required.`);
    if (!MNEMONIC_RE.test(mnemonic)) {
      throw new WizardInputError(
        `instructions[${i}].mnemonic must start with a letter and contain only letters, digits, '.', or '_'.`,
      );
    }
    const fmt = (typeof ins.format === 'string' ? ins.format.toUpperCase() : '') as WizardInstructionFormat;
    if (!ALLOWED_FORMATS.has(fmt)) {
      throw new WizardInputError(
        `instructions[${i}].format must be one of R, I, S, B, U, J.`,
      );
    }
    instructions.push({
      mnemonic,
      format: fmt,
      opcode: trim(ins.opcode, 64) || undefined,
      funct3: trim(ins.funct3, 32) || undefined,
      funct7: trim(ins.funct7, 32) || undefined,
      operands: Array.isArray(ins.operands)
        ? ins.operands
            .map((o) => (typeof o === 'string' ? o.trim() : ''))
            .filter((o) => o.length > 0 && o.length <= 16)
            .slice(0, 8)
        : undefined,
      summary: trim(ins.summary, 240) || undefined,
    });
  }

  const targetsRaw = raw.targets ?? {};
  const targets: Required<WizardTargetsInput> = {
    // Spike is always on, even if the input forgets it.
    spike: true,
    qemu: !!targetsRaw.qemu,
    binutils: !!targetsRaw.binutils,
    llvm: !!targetsRaw.llvm,
  };

  return {
    slug,
    version: versionRaw,
    description,
    author,
    license,
    isa: isaRaw,
    repository,
    homepage,
    standardStatus,
    authority: authorityRaw,
    instructions,
    targets,
  };
}

// ── Identifier / encoding helpers ─────────────────────────────────────────────

/** Convert a mnemonic / slug into a safe lowercase identifier (`x.add` → `x_add`). */
function safeIdent(s: string): string {
  let id = s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!id) id = 'insn';
  if (/^[0-9]/.test(id)) id = '_' + id;
  return id;
}

/** Convert a mnemonic into an UPPER_CASE C macro identifier (`x.add` → `X_ADD`). */
function macroIdent(s: string): string {
  return safeIdent(s).toUpperCase();
}

/**
 * Resolve a free-form opcode hint to its 7-bit numeric value, defaulting to
 * `custom-0` (0x0b). Recognized inputs include `custom-0..3`, `0bNNNNNNN`,
 * `0xNN`, plain decimal, and a 7-digit binary literal.
 */
function parseOpcode(raw?: string | null): number {
  if (!raw) return 0x0b;
  const t = raw.trim().toLowerCase();
  if (!t) return 0x0b;
  switch (t) {
    case 'custom-0':
    case 'custom0': return 0x0b;
    case 'custom-1':
    case 'custom1': return 0x2b;
    case 'custom-2':
    case 'custom2': return 0x5b;
    case 'custom-3':
    case 'custom3': return 0x7b;
  }
  if (t.startsWith('0b')) {
    const n = parseInt(t.slice(2), 2);
    return Number.isFinite(n) ? n & 0x7f : 0x0b;
  }
  if (t.startsWith('0x')) {
    const n = parseInt(t.slice(2), 16);
    return Number.isFinite(n) ? n & 0x7f : 0x0b;
  }
  if (/^[01]{1,7}$/.test(t)) return parseInt(t, 2) & 0x7f;
  if (/^[0-9]+$/.test(t)) return parseInt(t, 10) & 0x7f;
  return 0x0b;
}

/** Parse a funct3/funct7-style hint string to a numeric value. Defaults to 0. */
function parseFunct(raw?: string | null, maxBits = 7): number {
  if (!raw) return 0;
  const t = raw.trim().toLowerCase();
  if (!t) return 0;
  let n: number;
  if (t.startsWith('0b')) n = parseInt(t.slice(2), 2);
  else if (t.startsWith('0x')) n = parseInt(t.slice(2), 16);
  else if (/^[01]+$/.test(t) && t.length <= maxBits) n = parseInt(t, 2);
  else if (/^[0-9]+$/.test(t)) n = parseInt(t, 10);
  else n = 0;
  if (!Number.isFinite(n)) return 0;
  const mask = (1 << maxBits) - 1;
  return n & mask;
}

/** Format a number as a binary literal padded to `bits` digits, e.g. `0b0000111`. */
function bin(n: number, bits: number): string {
  return '0b' + n.toString(2).padStart(bits, '0');
}

/** Format a number as a 0x-prefixed hex literal padded to `digits`. */
function hex(n: number, digits = 2): string {
  return '0x' + n.toString(16).padStart(digits, '0');
}

// ── File templates ────────────────────────────────────────────────────────────

interface PackageFile {
  /** POSIX-style relative path, e.g. "tests/run.sh". */
  path: string;
  /** File contents (utf8 strings are encoded as Buffer internally). */
  content: string | Buffer;
  /** POSIX file mode (e.g. 0o755 for executables). Defaults to 0o644. */
  mode?: number;
}

const XSILIGNORE = `# Files / folders excluded from .xsil packing.
# Aligned with the CLI built-in ignore set.
.git/
.DS_Store
Thumbs.db

# Build artifacts
sim/bin/
**/*.o
**/*.elf
`;

const TOOLCHAIN_README = `# toolchain/

This package declares its toolchain as **external** (\`toolchain.external: true\`).
Install \`riscv64-unknown-elf-gcc\` (or whatever your target uses) on the host
that runs \`xsil run\` / \`xsil test\`.

If/when you bundle a toolchain inside the package, set \`toolchain.external\` to
\`false\` in \`manifest.json\` and unpack the toolchain into this directory.
`;

function readmeTemplate(
  slug: string,
  description: string,
  isa: string,
  standardStatus: StandardStatus,
  authority: string,
  instructions: WizardInstruction[],
): string {
  const insLines = instructions.length === 0
    ? '_No custom instructions declared yet._'
    : instructions
        .map((i) => `- \`${i.mnemonic}\` (${i.format})${i.summary ? ` — ${i.summary}` : ''}`)
        .join('\n');
  return `# ${slug}

${description}

**ISA:** \`${isa}\`
**Standard status:** \`${standardStatus}\`
**Authority:** ${authority}

## Run

\`\`\`bash
xsil install ${slug}
xsil run ${slug}
xsil test ${slug}
\`\`\`

## Custom instructions

${insLines}

## Targets

- \`spike\` — skeleton wired in \`sim/run.sh\`.
- \`qemu\`, \`binutils\`, \`llvm\` — declared as \`status: planned\` in \`manifest.json\`.

## Generated by

ExtenSilica Extension Wizard (skeleton). Edit each file as needed before publishing.
`;
}

function docsOverviewTemplate(slug: string, description: string, isa: string): string {
  return `# ${slug} — overview

${description}

This document is a starting point. Replace it with your extension's:

- motivation,
- ISA family (\`${isa}\`) and required base features,
- programmer model (registers, CSRs, traps),
- instruction set (see \`opcodes.json\`),
- intended targets (Spike today; QEMU/binutils/LLVM planned),
- compatibility considerations.
`;
}

function opcodesJsonTemplate(instructions: WizardInstruction[]): string {
  const out = {
    schemaVersion: 1,
    instructions: instructions.length === 0
      ? [
          {
            mnemonic: 'x.cust1',
            format: 'R',
            opcode: 'custom-0',
            funct3: '0b000',
            funct7: '0b0000000',
            operands: ['rd', 'rs1', 'rs2'],
            summary: 'rd = rs1 + rs2 (placeholder semantics; replace me).',
          },
        ]
      : instructions.map((i) => ({
          mnemonic: i.mnemonic,
          format: i.format,
          opcode: i.opcode ?? null,
          funct3: i.funct3 ?? null,
          funct7: i.funct7 ?? null,
          operands: i.operands ?? null,
          summary: i.summary ?? null,
        })),
  };
  return JSON.stringify(out, null, 2) + '\n';
}

const SIM_RUN_SH = `#!/bin/sh
# sim/run.sh — entry point for \`xsil run\`.
# Compiles examples/demo.S (if a riscv toolchain is present) and runs it under Spike;
# falls back to a printed expected output so the package still demos on hosts
# without a simulator installed.

set -eu

SRC="examples/demo.S"
ELF="sim/bin/demo.elf"

has() { command -v "$1" >/dev/null 2>&1; }

if [ ! -f "$ELF" ] && has riscv64-unknown-elf-gcc; then
  printf "Assembling %s for RV64GC...\\n" "$SRC"
  mkdir -p sim/bin
  riscv64-unknown-elf-gcc -march=rv64gc -mabi=lp64d -nostdlib -static -o "$ELF" "$SRC" || true
fi

if [ -f "$ELF" ] && has spike && has pk; then
  printf "[ spike rv64gc ] %s\\n\\n" "$ELF"
  spike pk "$ELF"
  exit $?
fi

# Fallback demo mode.
printf "\\n  %s — Demo Mode\\n" "$(basename "$(pwd)")"
printf "  ===================\\n"
printf "  No RISC-V toolchain or Spike found. Showing the expected output.\\n\\n"
cat tests/expected.txt
`;

const SIM_SPIKE_YAML = `# sim/spike.yaml — informational config consumed by your own scripts.
# The CLI does not parse this file; sim/run.sh / tests/run.sh do.
isa: rv64gc
priv: msu
mem: 256m
`;

const TESTS_RUN_SH = `#!/bin/sh
# tests/run.sh — entry point for \`xsil test\`.
# Runs sim/run.sh and compares its stdout against tests/expected.txt.

set -eu

actual="$(sh sim/run.sh 2>/dev/null || true)"
expected="$(cat tests/expected.txt)"

if [ "$actual" = "$expected" ]; then
  printf "PASS\\n"
  exit 0
fi

printf "FAIL\\n--- expected ---\\n%s\\n--- actual ---\\n%s\\n" "$expected" "$actual"
exit 1
`;

const TESTS_BASIC_S = `# tests/basic.S — placeholder smoke test (RV64I).
# Replace this with assembly that exercises your custom instructions.
.text
.globl _start
_start:
    li      a0, 0          # exit code = 0
    li      a7, 93         # SYS_exit (newlib pk syscall ABI)
    ecall
`;

const TESTS_EXPECTED = `extension demo: hello from RISC-V!
`;

const EXAMPLES_DEMO_S = `# examples/demo.S — minimal RV64I demo program.
# Prints a greeting via newlib pk's "write" + "exit" syscalls.
# Replace with code that uses your custom instructions.
.section .rodata
msg:    .ascii  "extension demo: hello from RISC-V!\\n"
msg_end:

.text
.globl _start
_start:
    li      a0, 1                      # fd = stdout
    la      a1, msg                    # buf
    li      a2, msg_end - msg          # count
    li      a7, 64                     # SYS_write
    ecall

    li      a0, 0
    li      a7, 93                     # SYS_exit
    ecall
`;

/**
 * Generate `opcodes.h`: a C header with `__asm__` helper macros for every
 * declared instruction, using the GAS `.insn` directive. This lets users
 * invoke the custom op from C/C++ without patching binutils.
 */
function opcodesHeaderTemplate(slug: string, instructions: WizardInstruction[]): string {
  const guard = `${safeIdent(slug).toUpperCase()}_OPCODES_H`;
  const lines: string[] = [];
  lines.push('/* Auto-generated by ExtenSilica Extension Wizard.');
  lines.push(' *');
  lines.push(` * Inline-assembly helper macros for ${slug}'s custom instructions,`);
  lines.push(' * emitted via the GAS `.insn` directive (no custom assembler required).');
  lines.push(' *');
  lines.push(' * Usage:');
  lines.push(' *   #include "opcodes.h"');
  lines.push(' *   uint64_t r;');
  if (instructions.length > 0) {
    const sample = instructions[0];
    if (sample) {
      lines.push(` *   ${macroIdent(sample.mnemonic)}(r, /* rs1 */ 1, /* rs2 */ 2);`);
    }
  } else {
    lines.push(' *   // Add custom instructions to opcodes.json and regenerate.');
  }
  lines.push(' */');
  lines.push(`#ifndef ${guard}`);
  lines.push(`#define ${guard}`);
  lines.push('');
  lines.push('#include <stdint.h>');
  lines.push('');

  if (instructions.length === 0) {
    lines.push('/* No custom instructions declared. Edit opcodes.json and regenerate this header. */');
    lines.push('');
  } else {
    for (const ins of instructions) {
      const macro = macroIdent(ins.mnemonic);
      const op = parseOpcode(ins.opcode);
      const f3 = parseFunct(ins.funct3, 3);
      const f7 = parseFunct(ins.funct7, 7);
      const summary = ins.summary ? ` ${ins.summary}` : '';
      lines.push(`/* ${ins.mnemonic} (${ins.format}-type):${summary} */`);
      switch (ins.format) {
        case 'R':
          lines.push(
            `#define ${macro}(rd, rs1, rs2) \\`,
            `    __asm__ __volatile__(".insn r ${hex(op)}, ${hex(f3)}, ${hex(f7)}, %0, %1, %2" \\`,
            '        : "=r"(rd) : "r"(rs1), "r"(rs2))',
          );
          break;
        case 'I':
          lines.push(
            `#define ${macro}(rd, rs1, imm) \\`,
            `    __asm__ __volatile__(".insn i ${hex(op)}, ${hex(f3)}, %0, %1, %2" \\`,
            '        : "=r"(rd) : "r"(rs1), "i"(imm))',
          );
          break;
        case 'S':
          lines.push(
            `#define ${macro}(rs2, rs1, imm) \\`,
            `    __asm__ __volatile__(".insn s ${hex(op)}, ${hex(f3)}, %0, %2(%1)" \\`,
            '        : : "r"(rs2), "r"(rs1), "i"(imm) : "memory")',
          );
          break;
        case 'B':
          lines.push(
            `#define ${macro}(rs1, rs2, label) \\`,
            `    __asm__ __volatile__(".insn b ${hex(op)}, ${hex(f3)}, %0, %1, " #label \\`,
            '        : : "r"(rs1), "r"(rs2))');
          break;
        case 'U':
          lines.push(
            `#define ${macro}(rd, imm) \\`,
            `    __asm__ __volatile__(".insn u ${hex(op)}, %0, %1" \\`,
            '        : "=r"(rd) : "i"(imm))',
          );
          break;
        case 'J':
          lines.push(
            `#define ${macro}(rd, label) \\`,
            `    __asm__ __volatile__(".insn j ${hex(op)}, %0, " #label \\`,
            '        : "=r"(rd))',
          );
          break;
      }
      lines.push('');
    }
  }

  lines.push(`#endif /* ${guard} */`);
  return lines.join('\n') + '\n';
}

/**
 * Generate a standalone runnable example for a single instruction, demonstrating
 * how to emit it via `.insn`. The program initialises the source operands,
 * issues the custom instruction, and exits cleanly under newlib's `pk` ABI.
 */
function instructionExampleTemplate(slug: string, ins: WizardInstruction): string {
  const op = parseOpcode(ins.opcode);
  const f3 = parseFunct(ins.funct3, 3);
  const f7 = parseFunct(ins.funct7, 7);
  const opStr = bin(op, 7);
  const f3Str = bin(f3, 3);
  const f7Str = bin(f7, 7);
  const summary = ins.summary || 'placeholder semantics';
  const head = `# examples/${safeIdent(ins.mnemonic)}.S — demo for \`${ins.mnemonic}\` (${ins.format}-type)
# Encoded via GAS .insn directive — no toolchain patching required.
# ${summary}
#
# Build: riscv64-unknown-elf-gcc -march=rv64gc -nostdlib -static $< -o demo.elf
# Run  : spike pk demo.elf

.text
.globl _start
_start:
`;
  let body = '';
  switch (ins.format) {
    case 'R':
      body =
`    li      t0, 5                          # rs1
    li      t1, 7                          # rs2
    .insn r ${opStr}, ${f3Str}, ${f7Str}, t2, t0, t1   # ${ins.mnemonic}: t2 <- f(t0, t1)
`;
      break;
    case 'I':
      body =
`    li      t0, 5                          # rs1
    .insn i ${opStr}, ${f3Str}, t2, t0, 12         # ${ins.mnemonic}: t2 <- f(t0, imm=12)
`;
      break;
    case 'S':
      body =
`    la      t0, scratch                    # base address
    li      t1, 0xCAFE                     # rs2 (value)
    .insn s ${opStr}, ${f3Str}, t1, 0(t0)           # ${ins.mnemonic}: store t1 at *(t0+0)
`;
      break;
    case 'B':
      body =
`    li      t0, 1
    li      t1, 1
    .insn b ${opStr}, ${f3Str}, t0, t1, taken      # ${ins.mnemonic}: branch if cond
    j       fall_through
taken:
fall_through:
`;
      break;
    case 'U':
      body =
`    .insn u ${opStr}, t2, 0xABCDE               # ${ins.mnemonic}: t2 <- imm<<12
`;
      break;
    case 'J':
      body =
`    .insn j ${opStr}, t2, target                # ${ins.mnemonic}: jump+link
target:
`;
      break;
  }
  const tail = `
    li      a0, 0                          # exit code = 0
    li      a7, 93                         # SYS_exit (newlib pk)
    ecall
`;
  let dataSection = '';
  if (ins.format === 'S') {
    dataSection = `
.section .bss
.align 3
scratch: .skip 8
`;
  }
  return `${head}${body}${tail}${dataSection}`;
}

/**
 * Combined assembly that exercises every declared instruction, used as a
 * single test entry. Each `.insn` is preceded by an inline comment with the
 * mnemonic so it is easy to match build errors back to opcodes.json.
 */
function instructionsCombinedTestTemplate(instructions: WizardInstruction[]): string {
  if (instructions.length === 0) {
    return `# tests/instructions.S — placeholder.
# Declare instructions in opcodes.json and regenerate to populate this file.
.text
.globl _start
_start:
    li      a0, 0
    li      a7, 93
    ecall
`;
  }
  let out = `# tests/instructions.S — exercises every instruction declared in opcodes.json.
# Each .insn directive is annotated with its mnemonic so failing assemblies are
# easy to trace back to the manifest.

.text
.globl _start
_start:
    li      t0, 5
    li      t1, 7
`;
  for (const ins of instructions) {
    const op = parseOpcode(ins.opcode);
    const f3 = parseFunct(ins.funct3, 3);
    const f7 = parseFunct(ins.funct7, 7);
    const opStr = bin(op, 7);
    const f3Str = bin(f3, 3);
    const f7Str = bin(f7, 7);
    out += `\n    # ${ins.mnemonic} (${ins.format}-type)${ins.summary ? ' — ' + ins.summary : ''}\n`;
    switch (ins.format) {
      case 'R':
        out += `    .insn r ${opStr}, ${f3Str}, ${f7Str}, t2, t0, t1\n`;
        break;
      case 'I':
        out += `    .insn i ${opStr}, ${f3Str}, t2, t0, 12\n`;
        break;
      case 'S':
        out += `    .insn s ${opStr}, ${f3Str}, t1, 0(t0)\n`;
        break;
      case 'B':
        out += `    .insn b ${opStr}, ${f3Str}, t0, t1, 1f\n1:\n`;
        break;
      case 'U':
        out += `    .insn u ${opStr}, t2, 0xABCDE\n`;
        break;
      case 'J':
        out += `    .insn j ${opStr}, t2, 1f\n1:\n`;
        break;
    }
  }
  out += `
    li      a0, 0
    li      a7, 93
    ecall
`;
  return out;
}

/**
 * Spike `extension_t` C++ skeleton. Registers one instruction handler per
 * declared op (R-type ones get a real `match`/`mask`; other formats are
 * left as TODOs to keep the compile path honest).
 */
function spikeExtensionCppTemplate(slug: string, instructions: WizardInstruction[]): string {
  const id = safeIdent(slug);
  const cls = `${id}_t`;
  const handlers = instructions.map((ins) => {
    const fn = `do_${safeIdent(ins.mnemonic)}`;
    if (ins.format === 'R') {
      return `// ${ins.mnemonic} (R-type)${ins.summary ? ' — ' + ins.summary : ''}
static reg_t ${fn}(processor_t* p, insn_t insn, reg_t pc) {
  (void)p;
  reg_t rs1 = RS1;
  reg_t rs2 = RS2;
  // TODO: replace with the real semantics of ${ins.mnemonic}.
  WRITE_RD(sext_xlen(rs1 + rs2));
  return pc + insn.length();
}
`;
    }
    return `// ${ins.mnemonic} (${ins.format}-type)${ins.summary ? ' — ' + ins.summary : ''}
static reg_t ${fn}(processor_t* p, insn_t insn, reg_t pc) {
  // TODO: implement ${ins.format}-type decoding for ${ins.mnemonic}.
  (void)p;
  return pc + insn.length();
}
`;
  }).join('\n');

  const desc = instructions.length === 0
    ? '  // No instructions declared yet — add entries in opcodes.json and regenerate.\n  return {};'
    : instructions.map((ins) => {
        const fn = `do_${safeIdent(ins.mnemonic)}`;
        const op = parseOpcode(ins.opcode);
        const f3 = parseFunct(ins.funct3, 3);
        const f7 = parseFunct(ins.funct7, 7);
        let match: string;
        let mask: string;
        switch (ins.format) {
          case 'R':
            match = `(${hex(op)}) | (${hex(f3)} << 12) | (${hex(f7)} << 25)`;
            mask  = '0x7f | (0x7 << 12) | (0x7f << 25)';
            break;
          case 'I':
          case 'S':
          case 'B':
            match = `(${hex(op)}) | (${hex(f3)} << 12)`;
            mask  = '0x7f | (0x7 << 12)';
            break;
          case 'U':
          case 'J':
            match = `(${hex(op)})`;
            mask  = '0x7f';
            break;
        }
        return `  // ${ins.mnemonic}\n  insns.push_back({${match}, ${mask}, ${fn}, ${fn}, ${fn}, ${fn}});`;
      }).join('\n') + '\n  return insns;';

  return `// ${id}_extension.cc — Spike (riscv-isa-sim) extension skeleton for "${slug}".
//
// Auto-generated by ExtenSilica Extension Wizard. Plug in the real semantics
// inside each "do_<mnemonic>" handler and rebuild with the included Makefile.
//
// Tested layout against riscv-isa-sim 1.1.0. Adjust the includes / API if you
// target a different Spike version (the extension API is moderately fluid).
// REGISTER_EXTENSION's first argument must be a valid C identifier, so we
// register as "${id}" — invoke Spike with --extension=${id}.

#include <riscv/extension.h>
#include <riscv/processor.h>
#include <riscv/decode_macros.h>
#include <vector>

${handlers}
class ${cls} : public extension_t {
public:
  const char* name() override { return "${id}"; }

  std::vector<insn_desc_t> get_instructions() override {
    std::vector<insn_desc_t> insns;
${desc}
  }

  std::vector<disasm_insn_t*> get_disasms() override { return {}; }

  void reset() override {}
};

REGISTER_EXTENSION(${id}, []() { return new ${cls}; })
`;
}

function spikeExtensionMakefileTemplate(slug: string): string {
  const id = safeIdent(slug);
  return `# sim/spike-extension/Makefile — builds the Spike extension into a shared lib.
#
# Override SPIKE_PREFIX to point at your Spike install (the directory that
# contains include/riscv/ headers).
#
#   make SPIKE_PREFIX=/opt/riscv

NAME    := ${id}
SRC     := ${id}_extension.cc
OBJ     := $(SRC:.cc=.o)
LIB     := lib$(NAME)_spike.so

SPIKE_PREFIX  ?= /usr/local
SPIKE_INCLUDE ?= $(SPIKE_PREFIX)/include

CXXFLAGS ?= -O2 -Wall -fPIC -std=c++17 -I$(SPIKE_INCLUDE)
LDFLAGS  ?= -shared

all: $(LIB)

$(LIB): $(OBJ)
\t$(CXX) $(LDFLAGS) -o $@ $<

$(OBJ): $(SRC)
\t$(CXX) $(CXXFLAGS) -c -o $@ $<

clean:
\trm -f $(OBJ) $(LIB)

.PHONY: all clean
`;
}

function spikeExtensionReadmeTemplate(slug: string): string {
  return `# Spike extension for \`${slug}\`

This directory contains a starter implementation of a [Spike](https://github.com/riscv-software-src/riscv-isa-sim)
extension that handles the custom instructions declared in \`opcodes.json\`.

## Build

\`\`\`bash
make SPIKE_PREFIX=/opt/riscv
\`\`\`

This produces \`lib${safeIdent(slug)}_spike.so\`.

## Run

\`\`\`bash
spike --extension=${safeIdent(slug)} \\
      --extlib=$(pwd)/lib${safeIdent(slug)}_spike.so \\
      pk ../../examples/demo.elf
\`\`\`

(Spike's \`REGISTER_EXTENSION\` macro requires a C identifier, so the
registered name uses underscores even when the package slug has hyphens.)

## Customize

Edit \`${safeIdent(slug)}_extension.cc\` to:

1. Update the \`match\`/\`mask\` patterns inside \`get_instructions()\` to match the
   bit layout you want (the wizard pre-fills them from opcode/funct3/funct7).
2. Implement the real semantics of every \`do_<mnemonic>\` handler.
3. Optionally provide disassembly entries via \`get_disasms()\`.

The Spike extension API has evolved over time. The skeleton targets riscv-isa-sim 1.1.0+.
Older or newer trees may need minor include / signature tweaks.
`;
}

function changelogTemplate(version: string): string {
  return `# Changelog

All notable changes to this package are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [${version}] — Initial release

### Added
- Initial \`.xsil\` skeleton scaffolded by the ExtenSilica Extension Wizard.
- \`opcodes.json\` with the declared custom instructions.
- Spike extension skeleton in \`sim/spike-extension/\`.
- Inline-asm helper macros in \`opcodes.h\`.
- Per-instruction examples in \`examples/\`.
`;
}

/**
 * LICENSE text for the most common SPDX ids. Returns `null` when the id is
 * unknown — the caller falls back to a short SPDX-link stub.
 */
function knownLicenseText(spdx: string, year: number, holder: string): string | null {
  switch (spdx) {
    case 'MIT':
      return `MIT License

Copyright (c) ${year} ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
    case 'BSD-2-Clause':
      return `BSD 2-Clause License

Copyright (c) ${year}, ${holder}

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
`;
    case 'BSD-3-Clause':
      return `BSD 3-Clause License

Copyright (c) ${year}, ${holder}
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
`;
    case 'ISC':
      return `ISC License

Copyright (c) ${year} ${holder}

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
`;
    case 'Unlicense':
      return `This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or distribute this
software, either in source code form or as a compiled binary, for any purpose,
commercial or non-commercial, and by any means.

In jurisdictions that recognize copyright laws, the author or authors of this
software dedicate any and all copyright interest in the software to the public
domain. We make this dedication for the benefit of the public at large and to
the detriment of our heirs and successors. We intend this dedication to be an
overt act of relinquishment in perpetuity of all present and future rights to
this software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <https://unlicense.org>
`;
    case 'CC0-1.0':
      return `Creative Commons Legal Code

CC0 1.0 Universal

Copyright (c) ${year} ${holder}

The full legal text of CC0 1.0 Universal is available at:
  https://creativecommons.org/publicdomain/zero/1.0/legalcode

Summary: the person associated with this work has dedicated it to the public
domain by waiving all of their rights under copyright law worldwide, to the
extent allowed by law.
`;
    case 'Apache-2.0':
      return `                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

Copyright ${year} ${holder}

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

For the full Apache 2.0 text, see https://www.apache.org/licenses/LICENSE-2.0.
`;
    case 'MPL-2.0':
      return `Mozilla Public License Version 2.0

Copyright (c) ${year} ${holder}

This Source Code Form is subject to the terms of the Mozilla Public License,
v. 2.0. If a copy of the MPL was not distributed with this file, You can
obtain one at https://mozilla.org/MPL/2.0/.
`;
    default:
      return null;
  }
}

function licenseTemplate(spdx: string, holder: string): string {
  const year = new Date().getUTCFullYear();
  const known = knownLicenseText(spdx, year, holder);
  if (known) return known;
  return `${spdx} License

Copyright (c) ${year} ${holder}

This package is distributed under the ${spdx} license.
The full text is available at https://spdx.org/licenses/${spdx}.html.
`;
}

// ── Manifest ──────────────────────────────────────────────────────────────────

function buildManifestObject(input: ReturnType<typeof normalizeWizardInput>): Record<string, unknown> {
  const targetsObj: Record<string, unknown> = {
    spike: {
      isa: input.isa.toLowerCase(),
      priv: 'msu',
      mem: '256m',
      config: 'sim/spike.yaml',
      status: 'skeleton',
    },
  };
  if (input.targets.qemu) targetsObj.qemu = { status: 'planned' };
  if (input.targets.binutils) targetsObj.binutils = { status: 'planned' };
  if (input.targets.llvm) targetsObj.llvm = { status: 'planned' };

  const m: Record<string, unknown> = {
    name: input.slug,
    version: input.version,
    description: input.description,
    author: input.author,
    license: input.license,
    isa: input.isa,
    standardStatus: input.standardStatus,
    authority: input.authority,
    entry: 'sh sim/run.sh',
    testEntry: 'sh tests/run.sh',
    readme: 'README.md',
    keywords: ['risc-v', 'extension', 'xsil', 'wizard'],
    toolchain: {
      root: 'toolchain',
      triple: 'riscv64-unknown-elf',
      version: '14.2.0',
      external: true,
    },
    targets: targetsObj,
  };
  if (input.repository) m.repository = input.repository;
  if (input.homepage) m.homepage = input.homepage;
  return m;
}

// ── Tar helpers ───────────────────────────────────────────────────────────────

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

async function packTarGz(files: PackageFile[]): Promise<Buffer> {
  const pack = tar.pack();
  // Sort tar entries by relative path so the archive is deterministic.
  // Note: this ordering does NOT influence the payload hash (that's computed
  // separately over file contents); it just makes the archive itself stable.
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  // IMPORTANT: attach the consumer BEFORE writing entries. `pack.entry`'s
  // callback only fires once the internal buffer drains, so without an active
  // consumer the loop deadlocks as soon as the first entry exceeds the default
  // highWaterMark (~16KB).
  const tarBufPromise = streamToBuffer(pack);

  for (const f of sorted) {
    const buf = Buffer.isBuffer(f.content) ? f.content : Buffer.from(f.content, 'utf8');
    await new Promise<void>((resolve, reject) => {
      pack.entry(
        { name: f.path, size: buf.length, mode: f.mode ?? 0o644, type: 'file' },
        buf,
        (err) => (err ? reject(err) : resolve()),
      );
    });
  }
  pack.finalize();

  const tarBuf = await tarBufPromise;
  return zlib.gzipSync(tarBuf);
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Build a `.xsil` skeleton in memory.
 *
 * @throws WizardInputError on invalid input.
 */
export async function generateXsilSkeleton(rawInput: WizardInput): Promise<GenerateXsilResult> {
  const input = normalizeWizardInput(rawInput);

  // Build payload files (everything except the root manifest.json).
  const payload: PackageFile[] = [
    { path: '.xsilignore', content: XSILIGNORE },
    {
      path: 'README.md',
      content: readmeTemplate(
        input.slug,
        input.description,
        input.isa,
        input.standardStatus,
        input.authority,
        input.instructions,
      ),
    },
    { path: 'CHANGELOG.md', content: changelogTemplate(input.version) },
    { path: 'LICENSE', content: licenseTemplate(input.license, input.author) },
    { path: 'opcodes.json', content: opcodesJsonTemplate(input.instructions) },
    { path: 'opcodes.h', content: opcodesHeaderTemplate(input.slug, input.instructions) },
    { path: 'docs/overview.md', content: docsOverviewTemplate(input.slug, input.description, input.isa) },
    { path: 'examples/demo.S', content: EXAMPLES_DEMO_S },
    { path: 'sim/run.sh', content: SIM_RUN_SH, mode: 0o755 },
    { path: 'sim/spike.yaml', content: SIM_SPIKE_YAML },
    {
      path: `sim/spike-extension/${safeIdent(input.slug)}_extension.cc`,
      content: spikeExtensionCppTemplate(input.slug, input.instructions),
    },
    { path: 'sim/spike-extension/Makefile', content: spikeExtensionMakefileTemplate(input.slug) },
    { path: 'sim/spike-extension/README.md', content: spikeExtensionReadmeTemplate(input.slug) },
    { path: 'tests/run.sh', content: TESTS_RUN_SH, mode: 0o755 },
    { path: 'tests/basic.S', content: TESTS_BASIC_S },
    { path: 'tests/expected.txt', content: TESTS_EXPECTED },
    { path: 'tests/instructions.S', content: instructionsCombinedTestTemplate(input.instructions) },
    { path: 'toolchain/README.md', content: TOOLCHAIN_README },
  ];

  // Per-instruction `.S` example files (one per declared instruction).
  for (const ins of input.instructions) {
    payload.push({
      path: `examples/${safeIdent(ins.mnemonic)}.S`,
      content: instructionExampleTemplate(input.slug, ins),
    });
  }

  // Compute payload hash exactly like `computePayloadHashFromDir`:
  //  - SHA-256 over file contents, in lexicographic POSIX path order;
  //  - exclude the root `manifest.json`;
  //  - apply the BUILTIN ignore list (notably `.xsilignore` itself);
  //  - apply the package's own `.xsilignore` content.
  const xsilignoreEntry = payload.find((f) => f.path === '.xsilignore');
  const ig = ignore();
  ig.add(BUILTIN_IGNORE_BLOCK);
  if (xsilignoreEntry) {
    const text = Buffer.isBuffer(xsilignoreEntry.content)
      ? xsilignoreEntry.content.toString('utf8')
      : xsilignoreEntry.content;
    ig.add(text);
  }
  const sortedPayload = [...payload].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const hash = crypto.createHash('sha256');
  let payloadSize = 0;
  for (const f of sortedPayload) {
    if (ig.ignores(f.path)) continue;
    const buf = Buffer.isBuffer(f.content) ? f.content : Buffer.from(f.content, 'utf8');
    hash.update(buf);
    payloadSize += buf.length;
  }
  const payloadHex = hash.digest('hex');

  // Build manifest with the freshly computed checksum.
  const manifestObj = buildManifestObject(input);
  manifestObj.checksums = { payload: `sha256:${payloadHex}`, archive: '' };
  manifestObj.payloadSize = payloadSize;
  const manifestJson = JSON.stringify(manifestObj, null, 2) + '\n';

  const allFiles: PackageFile[] = [
    { path: 'manifest.json', content: manifestJson },
    ...payload,
  ];

  const buffer = await packTarGz(allFiles);

  return {
    buffer,
    filename: `${input.slug}-${input.version}.xsil`,
    slug: input.slug,
    version: input.version,
    payloadChecksum: `sha256:${payloadHex}`,
  };
}
