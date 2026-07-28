# Package-page portability matrix (step 7)

The package detail page (`/package/[slug]`) shows a **Portability matrix** when
`Version.targets` JSON contains matrix fields.

## Columns

| Column | Meaning |
| ------ | ------- |
| Target | Core/interface id (`picorv32-pcpi`, …) |
| Pre-build | Flags only: Not assessed / Candidate / Looks mappable / Adapter required / Unsupported capability |
| Adapter | Native / Generated (…) / Required / — |
| Build | Passed / — |
| Tests | `N/N` and/or post-test label |
| Port package | Link to sibling evidence package |

**Never** display **Compatible** from capability flags. The UI sanitizes that
string to `Looks mappable` if a publisher supplies it.

## Opt-in shape (in `manifest.targets`)

```json
"picorv32-pcpi": {
  "status": "working",
  "preBuild": "Adapter required",
  "adapter": "Generated (pcpi_rsd)",
  "build": "Passed",
  "tests": "1500/1500",
  "postTest": "Differentially validated",
  "portPackage": "xmac-port-picorv32-pcpi"
}
```

Ordinary Spike/QEMU targets without these fields do **not** open the section.

## Code

| File | Role |
| ---- | ---- |
| `store-frontend/lib/portability-matrix.ts` | Parse + sanitize |
| `store-frontend/components/portability-matrix.tsx` | Table |
| `store-frontend/app/package/[slug]/page.tsx` | Section after Readiness |

XMAC packages under `portability/packages/` are filled by
`tools/build_port_packages.py` so counts match frozen evidence.
