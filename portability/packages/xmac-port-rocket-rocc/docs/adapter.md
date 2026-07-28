# Adapter notes (RoCC MVP)

Stock RoCC command channel presents `rs1` / `rs2` values (when `xs1`/`xs2` are
set in a full Rocket encoding). XMAC also reads `rd`, so `rtl/xsil_rocc.v`
exposes `cmd_rsd`.

Protocol covered by the BFM:

1. Decoupled `cmd` accept for matched custom opcodes  
2. `busy` while in flight  
3. Decoupled `resp` with `rd` + data  
4. Reject unrecognized opcodes (no `cmd_ready`)

Memory, IRQ, and PTW ports are out of scope for this evidence package.
