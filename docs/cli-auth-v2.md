# CLI authentication alongside web OAuth (v2)

**Purpose:** Document how **web OAuth** (GitHub / Google) coexists with the **existing CLI authentication model** so nothing in this phase forces the CLI through a browser or breaks token-based usage.

**See also:** [cli-v3.md](./cli-v3.md) (command reference), [auth-v3.md](./auth-v3.md) (registry auth model), [oauth-v1.md](./oauth-v1.md) (browser OAuth flow).

---

## What stays the same for the CLI

The `xsil` tool continues to authenticate with the **opaque API token** issued by the registry:

1. **`xsil login`** — interactive **email + password**; calls **`POST /auth/login`**; stores the returned **`token`** in **`~/.extensilica/config.json`** (see `cli/src/registry.rs`).
2. **Authenticated commands** — send **`Authorization: Bearer <token>`** on registry requests (publish, logout, `whoami`, etc.).
3. **`xsil whoami`** — calls **`GET /auth/me`** with the Bearer token and parses the **`user`** object from the JSON body. Extra top-level fields (for example **`oauthProviders`**) are **ignored** by the CLI; the handler still returns **`user`**, so the response remains backward compatible.

No CLI command in this phase opens a browser, performs an OAuth redirect, or implements an OAuth device or PKCE flow.

---

## What web users get (orthogonal to the CLI)

On the **store website**, users can sign in with **GitHub** or **Google** in addition to email/password. That path is browser-based, completes at the provider, and ends with the same registry primitive: a **rotating opaque `apiToken`** stored on the user row and sent to the client (for example after the one-time OAuth handoff exchange). The registry’s **`authenticate`** middleware still resolves the caller by **`Authorization: Bearer`** and `User.apiToken` — the same mechanism the CLI already uses.

Web OAuth does **not** replace or remove **`POST /auth/login`** or Bearer validation.

---

## Why this does not break the CLI story

| Concern | Status |
|--------|--------|
| CLI still obtains a token via **`POST /auth/login`** | Yes — unchanged. |
| CLI still sends **`Authorization: Bearer`** | Yes — unchanged. |
| **`GET /auth/me`** adds optional metadata (e.g. linked providers) | Yes — additive JSON; CLI reads **`user` only**. |
| CLI forced to use GitHub/Google in this phase | **No** — not part of the product scope here. |

---

## Future (not in this phase)

A natural later enhancement is an **OAuth 2.0 device authorization grant** (RFC 8628) or similar **device / headless** flow so the CLI can obtain a token without storing a password, while still ending in the same Bearer + `apiToken` model. That would be **new CLI and server endpoints**, explicit UX (“enter this code at …”), and documentation updates — **not** required for current web OAuth or for preserving today’s CLI behavior.

---

## Summary

- **Web:** GitHub / Google sign-in is browser OAuth; successful completion still yields registry API access via the **same token model** as password login.
- **CLI:** Keeps **token-based auth** via **`xsil login`** and **`Authorization: Bearer`**; **no** browser OAuth in this phase.
- **Future:** Device OAuth (or similar) is possible later without changing the core idea that the registry trusts **Bearer tokens** backed by `User.apiToken`.
