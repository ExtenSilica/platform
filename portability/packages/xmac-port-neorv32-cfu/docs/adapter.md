# Adapter notes (CFU)

Stock NEORV32 CFU presents `rs1_i` / `rs2_i` only. XMAC also reads `rd`, so
`rtl/xsil_cfu.vhd` exposes `rsd_i`.

Same evidence model as the PCPI port: BFM-backed differential validation, RF tap
documented separately for full-core `Verified on target`.
