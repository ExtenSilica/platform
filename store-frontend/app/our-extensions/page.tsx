import type { Metadata } from "next";
import Link from "next/link";
import styles from "../_extensilica-pages/showcase.module.css";

export const metadata: Metadata = {
  title: "Our Extensions",
  description:
    "Original RISC-V ISA extension engineering from ExtenSilica: validated RTL experiments, reproducible benchmarks, and ongoing research.",
  alternates: {
    canonical: "/our-extensions",
  },
};

export default function OurExtensionsPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.heroTag}>ExtenSilica / Original engineering</span>
        <h1>
          Extensions <em>built here.</em>
        </h1>
        <p className={styles.heroLead}>
          The public registry catalogs work from across the RISC-V ecosystem. This page is
          different: a record of ISA extensions developed by ExtenSilica itself, with
          implementation evidence, reproducible experiments, and explicit technical limits.
        </p>
        <div className={styles.heroMeta}>
          <span>Designed in Brazil</span>
          <span>Open technical artifacts</span>
          <span>Measured, not imagined</span>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="validated-heading">
        <div className={styles.sectionIntro}>
          <div>
            <span className={styles.eyebrow}>01 / Validated experimental work</span>
            <h2 id="validated-heading">Real instructions. Real evidence.</h2>
          </div>
          <p>
            Validated here means software tests, RTL simulation, full-processor simulation,
            synthesis, and place-and-route — not fabricated silicon or a finished FPGA product.
          </p>
        </div>

        <article className={styles.feature}>
          <div className={styles.featureCopy}>
            <div className={styles.tagRow}>
              <span className={`${styles.tag} ${styles.tagGood}`}>
                Validated in simulation &amp; synthesis
              </span>
              <span className={styles.tag}>RV32 · Custom ISA</span>
              <span className={styles.tag}>VHDL · NEORV32 CFU</span>
            </div>
            <h3>Xcrcind</h3>
            <p>
              Six RISC-V instructions for <strong>CRC-16/MODBUS</strong> and{" "}
              <strong>CRC-32</strong>, processing 1, 2, or 4 bytes per instruction. Developed
              for small embedded cores that benefit from fast integrity checks without lookup
              tables. The VHDL implementation targets the NEORV32 custom function unit (CFU).
            </p>
            <div className={styles.statGrid}>
              <div className={styles.stat}>
                <strong>~5×</strong>
                <span>
                  Faster CRC-32 than the iterative Zbc baseline tested on NEORV32
                </span>
              </div>
              <div className={styles.stat}>
                <strong>+518</strong>
                <span>LUT4 incremental hardware cost versus the same SoC without a CFU</span>
              </div>
              <div className={styles.stat}>
                <strong>+67 FF</strong>
                <span>Flip-flops added; no additional EBR or DSP blocks</span>
              </div>
            </div>
            <p className={styles.inlineNote}>
              Results from software tests, GHDL RTL simulation, full-processor simulation, ECP5
              synthesis, and place-and-route (NEORV32 v1.13.7.6 in the reported setup). These are
              simulation and synthesis results; no physical FPGA measurement is claimed.
              Compatibility with NEORV32 v1.13.8.2 has not been validated here. A public registry
              package link will be added once a canonical ExtenSilica package is published.
            </p>
          </div>
          <div
            className={styles.featureVisual}
            aria-label="Conceptual illustration of the Xcrcind instruction unit"
          >
            <div className={styles.chip}>
              <span>RISC-V / CUSTOM-0</span>
              <b>Xcrcind</b>
              <span>CRC-16 · CRC-32</span>
            </div>
            <div className={styles.codePanel}>
              <div className={styles.codeMuted}>// 1, 2 or 4 bytes per instruction</div>
              <div>
                <span className={styles.codeAccent}>crc16m.w</span> rd, rs1, rs2
              </div>
              <div>
                <span className={styles.codeAccent}>crc32.w</span> rd, rs1, rs2
              </div>
              <div className={styles.codeMuted}>// state in rs1, data in rs2</div>
            </div>
          </div>
        </article>
      </section>

      <section className={styles.section} aria-labelledby="method-heading">
        <div className={styles.sectionIntro}>
          <div>
            <span className={styles.eyebrow}>02 / Engineering discipline</span>
            <h2 id="method-heading">From instruction to evidence.</h2>
          </div>
        </div>
        <div className={styles.cardGrid}>
          <article className={styles.card}>
            <span className={styles.cardIndex}>01 — ARCHITECTURE</span>
            <h3>Precisely defined</h3>
            <p>
              Encoding, register operands, instruction semantics, corner cases, and the intended
              application are specified before performance claims.
            </p>
          </article>
          <article className={styles.card}>
            <span className={styles.cardIndex}>02 — IMPLEMENTATION</span>
            <h3>Usable artifacts</h3>
            <p>
              Reference models, C intrinsics, synthesizable VHDL, test vectors, and integration
              examples where available.
            </p>
          </article>
          <article className={styles.card}>
            <span className={styles.cardIndex}>03 — MEASUREMENT</span>
            <h3>Reproducible results</h3>
            <p>
              Software baselines, RTL simulation, synthesis reports, timing constraints, and
              limitations documented alongside the extension.
            </p>
          </article>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="research-heading">
        <div className={styles.sectionIntro}>
          <div>
            <span className={styles.eyebrow}>03 / Research pipeline</span>
            <h2 id="research-heading">Currently under investigation.</h2>
          </div>
        </div>
        <article className={styles.researchCard}>
          <div>
            <div className={styles.tagRow}>
              <span className={`${styles.tag} ${styles.tagDraft}`}>
                Research / concept stage — not implemented
              </span>
              <span className={styles.tag}>Satellite links</span>
            </div>
            <h3>Xsatlink</h3>
            <p>
              Research into specialized RISC-V instructions for synchronization and processing of
              telemetry over noisy satellite links. Early research candidates include{" "}
              <code>xsat.bscore</code> and <code>xsat.qscore</code> for packed, confidence-aware
              BPSK/QPSK synchronization scoring. Instruction semantics, novelty, performance, and
              RTL cost remain under evaluation. No RTL implementation, validation, or benchmark is
              claimed.
            </p>
          </div>
        </article>
      </section>

      <div className={styles.bottomCta}>
        <div>
          <h2>The registry belongs to the ecosystem.</h2>
          <p>
            These are ExtenSilica&apos;s authored experiments. Third-party packages in the public
            registry are not attributed to ExtenSilica.
          </p>
        </div>
        <div className={styles.ctaActions}>
          <Link className={styles.button} href="/search">
            Explore public registry
          </Link>
          <Link className={`${styles.button} ${styles.buttonSecondary}`} href="/founder">
            Meet the founder
          </Link>
        </div>
      </div>
      <p className={styles.footerNote}>
        ExtenSilica is an independent initiative and is not affiliated with RISC-V International.
      </p>
    </main>
  );
}
