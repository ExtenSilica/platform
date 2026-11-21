import type { Metadata } from "next";
import Link from "next/link";
import styles from "../_extensilica-pages/showcase.module.css";

export const metadata: Metadata = {
  title: "Founder",
  description:
    "Felipe Thomaz Pedroni — Brazilian computer engineer, researcher, and founder of ExtenSilica, an open registry for RISC-V ISA extensions.",
  alternates: {
    canonical: "/founder",
  },
};

export default function FounderPage() {
  return (
    <main className={styles.page}>
      <section className={`${styles.hero} ${styles.founderHero}`}>
        <div>
          <span className={styles.heroTag}>Founder / ExtenSilica</span>
          <h1>
            Felipe Thomaz <em>Pedroni.</em>
          </h1>
          <p className={styles.heroLead}>
            Brazilian computer engineer and researcher working at the intersection of computer
            architecture, embedded systems, real-time software, and reproducible engineering.
          </p>
          <div className={styles.heroMeta}>
            <span>Founder, ExtenSilica</span>
            <span>São Paulo, Brazil</span>
            <span>UFES alumnus</span>
          </div>
        </div>
        <div
          className={styles.monogram}
          aria-label="Typographic initials FTP; not a photograph"
        >
          <div>
            <strong>FTP</strong>
            <small>FOUNDER · ENGINEER</small>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="background-heading">
        <div className={styles.sectionIntro}>
          <div>
            <span className={styles.eyebrow}>01 / Background</span>
            <h2 id="background-heading">Built from engineering practice.</h2>
          </div>
        </div>
        <div className={styles.bioGrid}>
          <div className={styles.bodyText}>
            <p>
              Felipe holds a <b>B.Sc. in Computer Engineering</b> and an{" "}
              <b>M.Sc. in Computer Science</b> from the Federal University of Espírito Santo
              (UFES), Brazil.
            </p>
            <p>
              He spent approximately <b>16 years in research and development at Embraer</b>{" "}
              (2010–2026), working across embedded systems, distributed systems,
              command-and-control architectures, fault tolerance, resilience, and performance
              engineering for real-time and safety-critical computing.
            </p>
            <p>
              His independent work focuses on processor architecture, interference analysis,
              real-time scheduling, and tools that make low-level computing easier to inspect and
              reproduce.
            </p>
          </div>
          <div className={styles.miniList}>
            <div>
              <strong>M.Sc. — Computer Science</strong>
              <span>Federal University of Espírito Santo (UFES)</span>
            </div>
            <div>
              <strong>B.Sc. — Computer Engineering</strong>
              <span>Federal University of Espírito Santo (UFES)</span>
            </div>
            <div>
              <strong>2010–2026 · Research &amp; Development</strong>
              <span>
                Embraer — embedded, distributed, and performance-critical systems
              </span>
            </div>
            <div>
              <strong>2026 · Founder</strong>
              <span>ExtenSilica — open RISC-V extension infrastructure</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="work-heading">
        <div className={styles.sectionIntro}>
          <div>
            <span className={styles.eyebrow}>02 / Selected work</span>
            <h2 id="work-heading">Research and open engineering.</h2>
          </div>
        </div>
        <div className={styles.workList}>
          <article className={styles.workCard}>
            <span className={styles.workType}>Platform · Open source</span>
            <h3>ExtenSilica / XSIL Registry</h3>
            <p>
              Creator of the public registry, open <code>.xsil</code> package format, and Rust
              command-line tool for discovering and distributing versioned RISC-V ISA extensions.
            </p>
            <Link className={styles.link} href="/about">
              About the registry
            </Link>
          </article>
          <article className={styles.workCard}>
            <span className={styles.workType}>ISA research · VHDL</span>
            <h3>Xcrcind</h3>
            <p>
              Custom RISC-V CRC-16/MODBUS and CRC-32 instructions, evaluated with software models,
              RTL simulation, NEORV32 CFU integration, and ECP5 synthesis.
            </p>
            <Link className={styles.link} href="/our-extensions">
              View authored extensions
            </Link>
          </article>
          <article className={styles.workCard}>
            <span className={styles.workType}>Research preprint · 2026</span>
            <h3>Shared-resource interference</h3>
            <p>
              “A Per-Access Upper Bound for Shared-Resource Interference in Direct-Mapped Multicore
              Architectures.”
            </p>
            <a
              className={styles.link}
              href="https://arxiv.org/abs/2605.24026"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read on arXiv
            </a>
          </article>
          <article className={styles.workCard}>
            <span className={styles.workType}>Research preprint · 2026</span>
            <h3>EDF / CBS in Apache NuttX</h3>
            <p>
              Design, implementation, and virtual-time evaluation of EDF scheduling with
              constant-bandwidth servers in the Apache NuttX RTOS.
            </p>
            <a
              className={styles.link}
              href="https://doi.org/10.31224/8572"
              target="_blank"
              rel="noopener noreferrer"
            >
              View publication
            </a>
          </article>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="vision-heading">
        <div className={styles.sectionIntro}>
          <div>
            <span className={styles.eyebrow}>03 / Why ExtenSilica exists</span>
            <h2 id="vision-heading">An open home for architecture experiments.</h2>
          </div>
        </div>
        <div className={styles.bodyText}>
          <p>
            ExtenSilica exists so researchers and engineers worldwide can discover, publish,
            verify, and reuse RISC-V ISA extensions — while ExtenSilica continues original
            architecture research from Brazil. A proposal is more useful when encoding,
            assumptions, implementation, verification, and provenance travel together.
          </p>
        </div>
        <div className={styles.philosophy}>
          A specification is a starting point. Reproducible evidence is what lets other engineers
          build on it.
        </div>
      </section>

      <div className={styles.bottomCta}>
        <div>
          <h2>Engineering from Brazil, for a global community.</h2>
          <p>
            Independent development, open tools, and technical claims grounded in evidence.
          </p>
        </div>
        <div className={styles.ctaActions}>
          <Link className={styles.button} href="/our-extensions">
            Our extensions
          </Link>
          <a
            className={`${styles.button} ${styles.buttonSecondary}`}
            href="https://www.linkedin.com/in/felipethomazpedroni/"
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn profile ↗
          </a>
        </div>
      </div>
      <p className={styles.footerNote}>
        ExtenSilica is an independent initiative and is not affiliated with RISC-V International.
      </p>
    </main>
  );
}
