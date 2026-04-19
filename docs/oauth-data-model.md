# OAuth data model — `OAuthAccount`

This document describes the persistence layer added for **GitHub** and **Google** OAuth (phase 1). It complements the architecture notes in [`oauth-v1.md`](./oauth-v1.md). Provisioning and linking **security policy**: [`oauth-security.md`](./oauth-security.md).

---

## Relationship with `User`

- Each **`OAuthAccount`** row references exactly one **`User`** via **`userId`** (foreign key to `User.id`).
- A **`User`** may have **zero or more** `OAuthAccount` rows (e.g. GitHub only, Google only, or both after a future linking flow).
- The canonical **application identity** remains **`User`**: username, email, password hash, API token, profile fields, and all existing relations (`Extension`, `Maintainer`, `OrgMember`, etc.) stay on **`User`**.
- **`OAuthAccount`** stores **provider-specific identifiers and snapshots** only. It does not replace `User` and is not used for API authentication by itself.

```text
User 1 ──< OAuthAccount (github)
      └──< OAuthAccount (google)   // optional second row
```

---

## Table: `OAuthAccount`

| Column | Type | Required | Purpose |
|--------|------|----------|---------|
| `id` | `Int` (serial) | yes | Primary key |
| `userId` | `Int` | yes | FK → `User.id` |
| `provider` | `OAuthProvider` enum | yes | `github` \| `google` |
| `providerAccountId` | `String` | yes | Stable IdP subject (e.g. GitHub numeric id as string, Google `sub`) |
| `email` | `String?` | no | Optional snapshot from provider profile |
| `username` | `String?` | no | Optional snapshot (e.g. GitHub login) |
| `avatarUrl` | `String?` | no | Optional snapshot URL |
| `createdAt` | `DateTime` | yes | Row creation time |
| `updatedAt` | `DateTime` | yes | Prisma `@updatedAt` |

Enum **`OAuthProvider`**: `github`, `google`.

---

## Uniqueness constraints

1. **`@@unique([provider, providerAccountId])`**  
   - At most **one** row per external identity.  
   - Prevents duplicate bindings of the same GitHub/Google account to different users (account takeover / confusion).

2. **Index on `userId`** (`@@index([userId])`)  
   - Speeds up “list OAuth identities for this user” (settings, future unlink).

**Not enforced in this table**

- Uniqueness of “one GitHub + one Google per user” is **not** required at DB level; product rules may limit linking in application code later.

---

## Delete behavior

- **`onDelete: Cascade`** from `OAuthAccount.userId` → `User.id`.  
- When a **`User`** is deleted, all linked **`OAuthAccount`** rows are removed automatically, consistent with other child tables (`PasswordResetToken`, `OrgMember`, etc.) that cascade from `User`.

---

## Rationale: separate `OAuthAccount` from `User`

1. **Multiple providers per user** — A user may link GitHub and Google later; a normalized child table avoids wide nullable columns (`githubId`, `googleId`, …) on `User`.

2. **Stable provider identity** — `provider` + `providerAccountId` is the natural key from the IdP; keeping it in its own row keeps lookups simple and enforces **`@@unique([provider, providerAccountId])`** without overloading `User.email` or `User.username`.

3. **Snapshots vs source of truth** — `OAuthAccount.email`, `username`, `avatarUrl` are **optional snapshots** for debugging, display, or future sync. **`User`** remains authoritative for login email, profile `avatarUrl`, and CLI/API behavior unless product explicitly syncs.

4. **Minimal change to existing users** — **`User.passwordHash`**, **`User.email`**, and **`User.apiToken`** are unchanged in this migration; email/password and token auth keep working as today.

5. **Clear security boundary** — OAuth rows can be audited, indexed, and deleted independently of touching password material.

---

## Prisma location

- Schema: `store-backend/prisma/schema.prisma` — models `OAuthAccount`, enum `OAuthProvider`, relation `User.oauthAccounts`.
- Migration: `store-backend/prisma/migrations/20260419183000_add_oauth_account/migration.sql`.

---

## Revision history

| Date | Notes |
|------|--------|
| 2026-04-19 | Initial `OAuthAccount` model and migration |
