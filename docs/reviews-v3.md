# Reviews v3 — Package Ratings & Reviews

## Overview

Users authenticated with an ExtenSilica account can rate and review any `.xsil` package. The review system is intentionally simple: one review per user per package, a 1–5 star integer rating, and an optional free-text comment.

---

## Data model

```
Review
├── id          INT   primary key, auto-increment
├── packageId   INT   FK → Extension.id, CASCADE delete
├── userId      INT   FK → User.id, CASCADE delete
├── rating      INT   1–5 (validated at API layer)
├── comment     TEXT  optional, trimmed, max 1 000 characters
├── createdAt   DATETIME
└── updatedAt   DATETIME

UNIQUE (packageId, userId)     -- one review per user per package
```

Constraints:
- Deleting a package deletes all of its reviews (`onDelete: Cascade`).
- Deleting a user deletes all of their reviews (`onDelete: Cascade`).
- The unique index on `(packageId, userId)` is the sole enforcement of the one-review rule.

---

## API endpoints

### Public

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/packages/:name/reviews` | List all reviews for a package, ordered newest-first |

Response items:
```json
{
  "id": 1,
  "packageId": 3,
  "userId": 7,
  "username": "alice",
  "avatarUrl": null,
  "rating": 5,
  "comment": "Works perfectly with Spike.",
  "createdAt": "2026-03-01T12:00:00.000Z",
  "updatedAt": "2026-03-01T12:00:00.000Z"
}
```

### Authenticated (Bearer token required)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/packages/:name/reviews` | Create or update the caller's review (upsert) |
| `DELETE` | `/packages/:name/reviews/me` | Delete the caller's review |

`POST` body:
```json
{
  "rating": 4,
  "comment": "Good package, minor docs gap."
}
```

- `rating` is **required**, integer 1–5. Returns `400` otherwise.
- `comment` is optional. Trimmed; empty string stored as `null`.
- Posting when a review already exists **updates** it (upsert semantics).

Returns the full review object on `200`.

`DELETE` returns `204 No Content`. Silently succeeds if no review exists.

---

## Average rating in package responses

`GET /packages/:name` (package detail) now includes two computed fields derived from the `Review` table:

```json
{
  "reviewCount": 12,
  "averageRating": 4.3,
  ...
}
```

These are computed with a single `prisma.review.aggregate` call alongside the package fetch. The list endpoint (`GET /packages`) returns `reviewCount: 0, averageRating: null` for performance (no per-row aggregate query).

---

## Validation rules

| Rule | Where enforced |
|------|----------------|
| `rating` is an integer 1–5 | API controller |
| `comment` trimmed, max 1 000 chars | API controller |
| One review per user per package | DB unique constraint + upsert |
| Auth token required to write | `requireAuth` middleware |

---

## Frontend behavior

### Package page (`/package/:slug`)

- Average rating and review count are shown below the package description when at least one review exists, e.g. `★★★★☆ 4.2 (8 reviews)`.
- The **Reviews** section is rendered by the `ReviewsSection` client component, hydrated with server-fetched initial data.

### `ReviewsSection` client component

| State | Behaviour |
|-------|-----------|
| Not signed in | Prompt to sign in; reviews visible read-only |
| Signed in, no review | Write-review form with `StarPicker` (1–5) and optional comment |
| Signed in, has review | Own review shown with **Edit** / **Delete** buttons; rest of reviews below |
| Editing | Form pre-filled from existing review; **Cancel** button |

State updates are optimistic/local: after a successful API call the `reviews` array in component state is patched immediately without a full page reload.

### `StarPicker` component

Interactive star selector in `components/star-rating.tsx`. Hover previews the rating; click commits it. Displays a text label (Poor / Fair / Good / Very good / Excellent) below the stars.

---

## Auditing

All reviews are stored with `userId`, `createdAt`, and `updatedAt`. There is no anonymisation at the API layer — the `username` of every reviewer is returned with every review. Admins can query the `Review` table directly for moderation.

There is intentionally no downvoting, helpfulness voting, or verification of whether the reviewer actually used the package. These can be added later without breaking the current schema.
