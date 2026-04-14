# Analytics v3 — Package Download Analytics

## Design principles

- **Package-centric, not user-surveillance-centric.** No user identity is stored with download events. The unit of measurement is the download of a package version, not who downloaded it.
- **Simple and auditable.** One table, one helper function, one controller. Every download is a row increment in a daily bucket.
- **No external dependencies.** All analytics are computed from the `DownloadEvent` table in the same SQLite database used for the rest of the registry.

---

## Data model

### `DownloadEvent` table

```
DownloadEvent
├── id         INT    primary key, auto-increment
├── packageId  INT    FK → Extension.id, CASCADE delete
├── versionId  INT    FK → Version.id, CASCADE delete
├── day        STRING "YYYY-MM-DD" — one row per (package, version, day)
└── count      INT    default 1, incremented on each download
```

**Unique constraint:** `(packageId, versionId, day)` — at most one row per package × version × calendar day.

Downloads are grouped into **daily buckets**. When the same package-version is downloaded multiple times in one day, the `count` column is incremented using an atomic upsert. This keeps the table bounded in size: `O(packages × versions × active_days)`.

Additionally, two fast-access counters are maintained for list-view queries:

| Field | Model | Description |
|-------|-------|-------------|
| `Version.downloadCount` | Version | Total downloads for that specific version |
| `Extension.totalDownloads` | Extension | Total downloads across all versions |

These are incremented synchronously alongside the event bucket upsert.

---

## Download tracking

Every request to `/uploads/:filename` is intercepted by a custom Express handler. Before serving the file, the handler:

1. Resolves the `Version` row whose `xsilUrl` matches the requested path (one `findFirst` query).
2. Calls `recordDownload(packageId, versionId)` **fire-and-forget** (does not block the file response).
3. Streams the file with `res.sendFile`.

This means **all downloads are tracked transparently** — whether triggered by `xsil install` from the CLI, a direct download from the web UI, or any other HTTP client. No changes to clients are required.

```
GET /uploads/abc123.xsil
  ↓
resolves → Version { id: 7, extensionId: 3, version: "1.0.7" }
  ↓ (async, non-blocking)
recordDownload(3, 7)
  ├── upsert DownloadEvent { packageId:3, versionId:7, day:"2026-03-06", count:+1 }
  ├── Version 7  → downloadCount += 1
  └── Extension 3 → totalDownloads += 1
  ↓
file served immediately
```

---

## Stats API

### `GET /stats/packages/:name`

Public endpoint, no authentication required.

**Response shape:**

```json
{
  "slug": "fastaes",
  "allTime":    1234,
  "last7Days":    45,
  "last30Days":  123,
  "dailyHistory": [
    { "day": "2026-02-05", "count": 3 },
    { "day": "2026-02-06", "count": 0 },
    ...
    { "day": "2026-03-06", "count": 8 }
  ],
  "byVersion": [
    { "version": "1.0.7", "count90Days": 80 },
    { "version": "1.0.6", "count90Days": 43 }
  ]
}
```

**Fields:**

| Field | Description |
|-------|-------------|
| `allTime` | `Extension.totalDownloads` — fast cached counter |
| `last7Days` | `SUM(count)` from `DownloadEvent` where `day >= today - 7` |
| `last30Days` | `SUM(count)` from `DownloadEvent` where `day >= today - 30` |
| `dailyHistory` | 30-day daily series, zero-filled for days with no activity |
| `byVersion` | Per-version totals over the last 90 days, sorted by count descending |

**Time windows use string comparison** (`day >= "YYYY-MM-DD"`) which is valid because the ISO date format is lexicographically ordered.

**Zero-filling:** `dailyHistory` is padded with `{day, count: 0}` entries for days with no downloads so the chart always shows a continuous 30-day series.

---

## Frontend display

The package detail page (`/package/:slug`) shows the following in the **Downloads** section:

### Stat cards

Three summary cards:

- **Last 7 days** — from `stats.last7Days`
- **Last 30 days** — from `stats.last30Days` (shown only if stats endpoint is available)
- **All time** — from `stats.allTime`

The sidebar also shows a compact 2-card view (7 days / 30 days or all time).

### 30-day daily chart

A pure-CSS bar chart rendered server-side showing one bar per day for the past 30 days. No JavaScript is required — the chart is a flex container of `<div>` elements with `height` set proportionally via inline styles.

- Bars with zero downloads are rendered as a faint stub (1% height) to maintain visual continuity.
- Hovering a bar shows a native tooltip with the date and download count.
- x-axis labels every 7 days.

### Per-version breakdown

A horizontal bar chart showing relative download share per version:

- If event-based stats are available (`byVersion` from the stats endpoint), uses 90-day counts.
- Falls back to `Version.downloadCount` (all-time cached counter) if no event data is available.
- Bars are normalized to the highest-count version (100%).

---

## Query complexity

| Query | Complexity | Runs on |
|-------|-----------|---------|
| Package list | O(1) per package — reads `totalDownloads` | Extension table |
| Package detail | O(1) per call — `SUM` aggregates on pre-bucketed rows | DownloadEvent |
| Daily history | O(30) rows at most per package | DownloadEvent |
| Per-version breakdown | O(versions) | DownloadEvent |

No full table scans required. All queries use the `packageId` + `day` columns that are covered by the unique index.

---

## What is not tracked

By design, the following are **not** recorded:

- User identity (no `userId` in `DownloadEvent`)
- IP addresses
- User-agent strings
- Geographic location
- Referrer URLs

This keeps the analytics simple, privacy-respecting, and auditable: the only data in `DownloadEvent` is *which package-version was downloaded on which day, and how many times*.
