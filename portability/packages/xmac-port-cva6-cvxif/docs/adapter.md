# Adapter notes (CV-X-IF MVP)

Stock CV-X-IF register interface presents `rs1` / `rs2` (and optionally `rs3`).
XMAC also reads `rd`, so `rtl/xsil_cvxif.v` exposes `register_rsd`.

Protocol covered by the BFM:

1. Issue accept/reject + writeback flags  
2. Register operands (SPLIT=0 style)  
3. Commit before result  
4. Result writeback  

Rejected unrecognized opcodes must not emit a result. Full-core RF tap and
compressed offload are out of scope for this evidence package.
