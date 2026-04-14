------

*Context: ExtenSilica is the distribution platform for RISC-V extension packages (bitstreams, toolchains, and verification artifacts).*

------

# **Architectural Fidelity Risk in RISC-V Emulation**

## **A Deterministic LR/SC Coherence Granularity Probe and Its Implications for Safety & Security Assurance**

**Author:** Product Security Engineering
**Organization:** Embraer
**Distribution:** Internal – Engineering / Safety / V&V / Tooling
**Status:** Internal Technical White Paper

------

## Abstract

This paper presents a **deterministic, architecture-level probe** that exposes a **semantic mismatch** between real RISC-V hardware and common emulation environments regarding **Load-Reserved / Store-Conditional (LR/SC)** reservation invalidation.

The technique relies on **cache-coherence–mandated reservation granularity** and does **not** depend on timing, scheduling, or undefined behavior. When executed on real hardware, the probe behaves strictly as required by coherence protocols. When executed under certain emulators, the probe reveals **overly fine-grained reservation tracking**, a known performance trade-off in software emulation.

We demonstrate why this discrepancy constitutes a **verification integrity and assurance risk** in avionics development flows, even though it does **not** represent an in-service vulnerability.

------

## 1. Motivation (Engineering Perspective)

Modern avionics software increasingly depends on:

- Lock-free algorithms
- RTOS atomic primitives
- Fine-grained concurrency control

When emulators are used in early development, CI pipelines, or regression testing, **architectural deviations** can silently invalidate verification assumptions.

This paper documents one such deviation with **reproducible source code**, enabling engineering teams to reason concretely about the risk.

------

## 2. Architectural Background: LR/SC and Coherence

### 2.1 Required Hardware Semantics

On real RISC-V implementations with caches:

- `LR` establishes a reservation on a **coherence granule**
- The granule is typically a **cache line (64B or 128B)**
- **Any store** to the same cache line **must invalidate** the reservation
- A subsequent `SC` **must fail**

This is required for correctness of atomic primitives.

### 2.2 Emulator Trade-Off

Software emulators (e.g., TCG-based DBT engines):

- Often track reservations at **exact addresses**
- Do not model cache-line–wide invalidation
- Prioritize performance over microarchitectural fidelity

This is not a bug — it is a **design compromise**.

------

## 3. The Detection Technique (Core Contribution)

### 3.1 Key Insight

> **A store to a neighboring word in the same cache line must kill an LR reservation on real hardware.**

If `SC` succeeds after such a store, the execution environment is **architecturally unrealistic**.

------

## 4. Source Code (Reference Implementation)

The following program is a **user-space Linux RISC-V probe**.

### 4.1 Full Source Code

```c
// Compile with: gcc -O2 -o detect_coherence detect_coherence.c
// Works on user-space Linux (RISC-V)

#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

// Force alignment to 128 to cover largest standard cache lines (64B/128B)
// We want to ensure 'base' is at the start of a line.
struct {
    uint8_t buffer[256];
} __attribute__((aligned(128))) probe_area;

/**
 * atomic_reservation_probe:
 * Performs the LR/SC sequence with a specific interference offset.
 * * Returns:
 * 0 -> SC Succeeded (Reservation Survived) -> LIKELY EMULATOR
 * 1 -> SC Failed    (Reservation Killed)   -> LIKELY REAL HARDWARE
 */
static inline int atomic_reservation_probe(volatile uint32_t *target,
                                           volatile uint32_t *neighbor) {
    uint32_t sc_result;
    uint32_t tmp_val;
    uint32_t junk = 0xBADF00D;

    asm volatile (
        "lr.w %1, (%2)\n\t"       // 1. Load Reserved from target
        "sw   %3, (%4)\n\t"       // 2. Store to neighbor (The Attack)
        "fence rw, rw\n\t"        // 3. Ensure store is visible
        "sc.w %0, %1, (%2)\n\t"   // 4. Store Conditional to target
        : "=&r" (sc_result), "=&r" (tmp_val)
        : "r" (target), "r" (junk), "r" (neighbor)
        : "memory"
    );

    return sc_result;
}

int main() {
    printf("[*] RISC-V Coherence Granularity Forensics\n");

    volatile uint32_t *base =
        (volatile uint32_t *)&probe_area.buffer[0];
    int is_emulator = 0;

    memset((void*)probe_area.buffer, 0, sizeof(probe_area.buffer));

    int offsets[] = {4, 8, 16, 32, 64};

    for (int t = 0; t < 5; t++) {
        int offset = offsets[t];
        volatile uint32_t *neighbor =
            (volatile uint32_t *)&probe_area.buffer[offset];

        printf("    Probing offset +%02d bytes... ", offset);

        int success_count = 0;
        for (int i = 0; i < 100; i++) {
            if (atomic_reservation_probe(base, neighbor) == 0)
                success_count++;
        }

        if (success_count > 0) {
            printf("[SC SUCCEEDED] (Reservation survived store)\n");
            is_emulator = 1;
        } else {
            printf("[SC FAILED]    (Reservation killed correctly)\n");
        }
    }

    printf("--------------------------------------------------\n");
    if (is_emulator) {
        printf("[!] FINAL VERDICT: EMULATOR DETECTED\n");
        printf("    Reason: sc.w succeeded despite interfering store.\n");
    } else {
        printf("[+] FINAL VERDICT: REAL HARDWARE\n");
    }

    return is_emulator;
}
```

------

## 5. Step-by-Step Technical Interpretation

### 5.1 Memory Layout Guarantee

- Buffer is **128-byte aligned**
- All tested offsets ≤ 64 bytes are **within the same cache line**
- This removes ambiguity about coherence boundaries

### 5.2 Instruction Semantics

| Instruction     | Expected Hardware Effect            |
| --------------- | ----------------------------------- |
| `lr.w`          | Establish reservation on cache line |
| `sw` (neighbor) | **Invalidate reservation**          |
| `sc.w`          | Must fail (`sc_result = 1`)         |

### 5.3 Interpretation Rule

- **Any successful `sc.w`** after the neighbor store
  → reservation was **not invalidated**
  → violates cache coherence semantics
  → indicates emulation

------

## 6. Experimental Results

### 6.1 Emulator Output (Observed)

```
Probing offset +04 bytes... [SC SUCCEEDED]
Probing offset +08 bytes... [SC SUCCEEDED]
Probing offset +16 bytes... [SC SUCCEEDED]
Probing offset +32 bytes... [SC SUCCEEDED]
Probing offset +64 bytes... [SC SUCCEEDED]
FINAL VERDICT: EMULATOR DETECTED
```

### 6.2 Real Hardware Expectation

- `SC` must **always fail** for offsets within the same line
- Occasional failure noise is acceptable
- **Success is architecturally forbidden**

------

## 7. Why This Matters for Aircraft Systems

### 7.1 Not an In-Service Attack

This does **not** imply:

- Compromise of deployed avionics
- Runtime exploitation on aircraft

Aircraft do not run under emulation.

### 7.2 Assurance & Certification Impact

The real risk is **upstream**:

- Atomic primitives validated under emulation may be **incorrect**
- Lock-free code may pass CI but fail on silicon
- Safety evidence may rely on **invalid assumptions**

This undermines:

- DO-178C verification arguments
- Tool qualification confidence
- Deterministic concurrency guarantees

------

## 8. Security Framing (Correct One)

This is **not** a red-team exploit.

This is a **security-relevant integrity violation of the development environment**.

> Security here means:
> **“Can we trust the behavior of our tools when asserting safety?”**

------

## 9. Recommended Engineering Actions

1. **Classify emulators as behavior-bounded tools**
2. **Never certify concurrency correctness based solely on emulation**
3. **Add architectural probes to CI pipelines**
4. **Cross-review atomic code on real hardware or high-fidelity simulation**
5. **Treat tool fidelity as a security concern**

------

## 10. Conclusion

This paper provides:

- A **concrete, minimal, reproducible artifact**
- A **deterministic architectural argument**
- A **clear safety & security linkage**

It shows how **security thinking protects safety evidence**, not how attackers break aircraft.

------

