# Repository layout: private platform vs public `xsil`

## Two repositories

| Repository | Visibility | Contents |
|------------|------------|----------|
| **This repo** (ExtenSilica platform) | **Private** | `store-backend/`, `store-frontend/`, deploy runbooks, OAuth and product code, `scripts/`, `brand/`. |
| **[ExtenSilica/xsil](https://github.com/ExtenSilica/xsil)** | **Public** | `xsil` CLI (`cli/`), normative **`spec/xsil.md`**, **`examples/rvx-demo`**, format-focused docs. |

Installers on **extensilica.com** (`public/install.sh`, `install.ps1`) download release binaries from the **public** `ExtenSilica/xsil` GitHub Releases (`cli/v*.*.*` tags).

## Dependency direction

- The **private** stack **does not** embed the Rust CLI as a submodule in production.
- The **private** repo **depends on** the public project in these ways:
  - **Normative spec URL** — documentation and the FAQ link to `https://github.com/ExtenSilica/xsil/blob/main/spec/xsil.md`.
  - **Release binaries** — users and servers install `xsil` from the public repo’s releases.
  - **Test fixture** — `store-backend/test/fixtures/rvx-demo/` is a copy of the public example tree so backend tests and `scripts/publish-rvx-demo.sh` work **without** cloning the public repo on CI.

When you change the reference package or manifest rules in **public** `xsil`, refresh the fixture if needed:

```bash
rsync -a --delete /path/to/xsil-public/examples/rvx-demo/ store-backend/test/fixtures/rvx-demo/
```

Then re-run `xsil publish --dry-run` (from a public clone) and backend tests.

## CI

- **Public** `xsil`: Rust `fmt`, `clippy`, `test`, and **`cli/v*.*.*`** release builds.
- **Private** platform: Node/TypeScript checks for `store-backend` and `store-frontend` only.
