-- Replace the single `User.apiToken` column with a normalised `ApiToken` table
-- so each user can hold N independent credentials (web sessions, CLI installs,
-- CI bots…). The raw token is only ever shown at creation time; the server
-- stores `sha256(raw)` so a database leak does not expose live credentials.
--
-- Backfill strategy: every existing non-null `User.apiToken` becomes one
-- `ApiToken` row named "Legacy token". After deploy, existing browser/CLI
-- sessions keep working because the new middleware hashes the bearer token
-- and finds the migrated row.

-- 1. Enable pgcrypto (idempotent) so we can hash the legacy tokens in SQL.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create the ApiToken table.
CREATE TABLE "ApiToken" (
  "id"         SERIAL PRIMARY KEY,
  "userId"     INTEGER     NOT NULL,
  "name"       TEXT        NOT NULL,
  "tokenHash"  TEXT        NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt"  TIMESTAMP(3),

  CONSTRAINT "ApiToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash");
CREATE INDEX        "ApiToken_userId_idx"   ON "ApiToken"("userId");

-- 3. Backfill from existing User.apiToken rows. Use sha256 hex digest so the
--    middleware lookup matches the raw tokens still held by browsers / CLIs.
INSERT INTO "ApiToken" ("userId", "name", "tokenHash", "createdAt")
SELECT
  "id"                                                            AS "userId",
  'Legacy token'                                                  AS "name",
  encode(digest("apiToken"::bytea, 'sha256'), 'hex')              AS "tokenHash",
  CURRENT_TIMESTAMP                                               AS "createdAt"
FROM "User"
WHERE "apiToken" IS NOT NULL;

-- 4. Drop the legacy column + its uniqueness constraint.
DROP INDEX IF EXISTS "User_apiToken_key";
ALTER TABLE "User" DROP COLUMN "apiToken";
