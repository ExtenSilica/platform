# Package Name Policy

_ExtenSilica Registry · v3 · Last revised: 2026-03-06_

---

## 1. Purpose

This document defines the rules governing package name registration on the
ExtenSilica registry. The goals are:

- **Clarity** — authors know exactly what names are allowed.
- **Anti-squatting** — prevent bad-faith reservation of valuable names.
- **Namespace hygiene** — keep the registry clean and discoverable.

---

## 2. Name Format Rules (enforced)

| Constraint | Rule |
|---|---|
| Allowed characters | Lowercase letters (`a–z`), digits (`0–9`), hyphens (`-`). Underscores are normalised to hyphens. |
| Start / end | Must start and end with a letter or digit — no leading or trailing hyphens. |
| Minimum length | 2 characters. |
| Maximum length | 64 characters. |
| Pattern | `^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$` (or a 1–2 character all-alphanumeric name). |

Examples of **valid** names: `rvx-demo`, `gem5-riscv`, `aes128`, `zlib2`.

Examples of **invalid** names: `-demo` (leading hyphen), `my_lib` (underscores
normalised, but if residual chars remain the slug is invalid), `x` (too short),
`a-name-that-goes-beyond-sixty-four-characters-for-no-good-reason` (too long).

---

## 3. Reserved Names (enforced)

The following names, and their slugified equivalents, can never be registered
regardless of who requests them.  Attempting to create a package with any of
these names returns HTTP **400** with an explicit error message.

### Platform / brand

`xsil`, `extensilica`, `registry`, `store`, `platform`

### Privilege / system

`admin`, `administrator`, `root`, `system`, `superuser`, `sudo`,
`moderator`, `staff`, `support`, `official`, `security`

### Common stubs / placeholder abuse

`test`, `testing`, `demo`, `example`, `sample`, `placeholder`,
`undefined`, `null`, `none`, `noop`, `empty`, `blank`,
`todo`, `fixme`, `temp`, `tmp`

### Generic top-level words (namespace pollution)

`lib`, `core`, `base`, `common`, `utils`, `util`, `tools`,
`api`, `sdk`, `cli`, `app`, `pkg`, `package`,
`v1`, `v2`, `v3`

> Reserved names are maintained in
> `store-backend/src/controllers/packagesController.ts` (`RESERVED_NAMES` set).
> The list may be extended at any time; additions are not considered breaking
> changes.

---

## 4. Immutability After First Publish (enforced)

Once a package has at least one published version, its name is **permanently
reserved** for that namespace — even if all versions are yanked or the package
is deleted by an admin.  This prevents supply-chain attacks where an attacker
re-registers a deleted name and publishes malicious content.

Consequence: package deletion is intentionally hard. Contact the platform team
if you need to remove a package entirely.

---

## 5. Squatting Policy

### 5.1 Definition

"Squatting" is the act of registering a package name with no intent to publish
genuine content, typically to:

- Hold a name ransom.
- Impersonate another project or organisation.
- Occupy a large block of the namespace.

### 5.2 Abandoned name reclamation (policy, not yet automated)

A package with **zero published versions** for more than **30 days** is
considered abandoned and may be reclaimed by the platform team without notice.
This will be enforced automatically in a future release via a scheduled job.
Authors who genuinely need longer lead time should publish a `0.1.0-alpha`
stub version.

### 5.3 Impersonation

Packages whose names are clearly intended to impersonate an existing
well-known project (e.g. `gem5-official`, `qemu-core`) may be removed by
the moderation team.  Report suspected impersonation at
[support@extensilica.com](mailto:support@extensilica.com).

---

## 6. What Is NOT Enforced (future work)

| Feature | Status | Notes |
|---|---|---|
| Typosquatting similarity checks | 🔲 not implemented | Levenshtein-distance checks produce too many false positives at the current registry size. Revisit at 10 k+ packages. |
| Organisation scopes (`@org/pkg`) | 🔲 not implemented | Organisation model exists in schema; scope support is deferred. |
| Automated abandoned-name reclamation | 🔲 not implemented | Policy is defined (§5.2); cron job not yet scheduled. |
| Admin override API | 🔲 not implemented | Admins currently act directly in the database. A `/admin/packages/:name/reclaim` endpoint is planned. |

---

## 7. Requesting a Reserved Name

If you have a legitimate need for a reserved name (e.g. you are the author of
the `xsil` toolchain and want to publish official packages under that brand),
contact [support@extensilica.com](mailto:support@extensilica.com) with:

1. The desired name.
2. A brief description of the package.
3. A link to your organisation or project.

The platform team will manually create the package and transfer ownership to
your account.

---

_This policy may be updated at any time. Material changes will be announced on
the registry blog._
