# Zenodo automation — future (PR-G6b)

**Status:** not implemented (low priority, large scope).

Manual DOI workflow is documented in [zenodo-doi.md](./zenodo-doi.md) (PR-G6a). This note records intent so we do not half-ship automation or promise DOIs in product copy before it exists.

---

## Goal (when built)

After a **successful** `xsil publish` (or admin-approved release), optionally:

1. Build a Zenodo-compatible metadata payload from registry + `manifest.json`.
2. Deposit the `.xsil` blob (or a checksum-addressed copy from object storage).
3. Store returned DOI as an `ExternalCitation` (PR-G2) linked to `Extension` / `Version`.

---

## Prerequisites (blockers)

| Dependency | Why |
|------------|-----|
| PR-G2 `ExternalCitation` + admin CRUD | Persist DOI on the package |
| PR-G2b `GET /packages/:slug/citation` | Canonical CFF/BibTeX for deposits |
| Stable production storage URLs | Zenodo needs fetchable artifacts |
| Zenodo API token + community | Ops secret, rate limits |
| Legal (L2) | Confirm off-platform funding + no custodial copy |

---

## Non-goals

- Tying DOI minting to payment, sponsorship tiers, or escrow.
- Writing DOI into `manifest.json` (remains registry-side metadata).
- Replacing upstream’s own Zenodo record when they already publish one.

---

## Suggested shape (sketch only)

```text
POST /internal/zenodo/deposit   (platform admin or maintainer opt-in)
  → queue job
  → Zenodo API new deposition + upload file from storage key
  → on success: POST /admin/citations { kind: "doi", url: "https://doi.org/..." }
```

Feature flag: `ZENODO_DEPOSIT_ENABLED=false` by default.

---

## Until G6b ships

- Use [zenodo-doi.md](./zenodo-doi.md) for all citations.
- Do not add UI copy such as “DOI assigned on publish.”
- CI and schema guards (PR-G8) still apply — no financial schema drift.
