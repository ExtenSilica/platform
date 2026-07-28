# Adapter notes (PCPI)

Stock PicoRV32 PCPI presents `pcpi_rs1` / `pcpi_rs2` only. XMAC also reads `rd`,
so `rtl/xsil_pcpi.v` exposes `pcpi_rsd`.

Differential evidence drives a BFM that supplies `pcpi_rsd`. Integrating with
the real CPU requires forwarding `cpuregs[rd]` when `pcpi_valid` is high — see
ExtenSilica `portability/docs/rd-adapter.md`.
