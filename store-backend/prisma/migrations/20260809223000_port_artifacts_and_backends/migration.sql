-- Finish the Extension/Port split without breaking historical installs.
-- Legacy xmac-port-* rows become internal artifacts attached to backend-aware
-- Ports. They remain addressable by slug, but are excluded from the catalog.

CREATE TYPE "ExtensionRecordKind" AS ENUM ('extension', 'port_artifact');

ALTER TABLE "Extension"
  ADD COLUMN "recordKind" "ExtensionRecordKind" NOT NULL DEFAULT 'extension';

ALTER TABLE "Port"
  ADD COLUMN "backendSlug" TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN "backendName" TEXT,
  ADD COLUMN "artifactExtensionId" INTEGER;

ALTER TABLE "ImplementationRequest"
  ADD COLUMN "backendSlug" TEXT,
  ADD COLUMN "backendName" TEXT;

-- Preserve the integration interface that used to exist only inside artifact
-- package names and manifest target keys.
UPDATE "Port" AS p
SET
  "backendSlug" = CASE t."slug"
    WHEN 'cva6' THEN 'cvxif'
    WHEN 'neorv32' THEN 'cfu'
    WHEN 'picorv32' THEN 'pcpi'
    WHEN 'rocket' THEN 'rocc'
    WHEN 'reference' THEN 'semantic-model'
    ELSE 'default'
  END,
  "backendName" = CASE t."slug"
    WHEN 'cva6' THEN 'CV-X-IF'
    WHEN 'neorv32' THEN 'CFU'
    WHEN 'picorv32' THEN 'PCPI'
    WHEN 'rocket' THEN 'RoCC'
    WHEN 'reference' THEN 'Semantic model'
    ELSE NULL
  END
FROM "Target" AS t
WHERE p."targetId" = t."id";

UPDATE "ImplementationRequest" AS r
SET
  "backendSlug" = CASE t."slug"
    WHEN 'cva6' THEN 'cvxif'
    WHEN 'neorv32' THEN 'cfu'
    WHEN 'picorv32' THEN 'pcpi'
    WHEN 'rocket' THEN 'rocc'
    WHEN 'reference' THEN 'semantic-model'
    ELSE 'default'
  END,
  "backendName" = CASE t."slug"
    WHEN 'cva6' THEN 'CV-X-IF'
    WHEN 'neorv32' THEN 'CFU'
    WHEN 'picorv32' THEN 'PCPI'
    WHEN 'rocket' THEN 'RoCC'
    WHEN 'reference' THEN 'Semantic model'
    ELSE NULL
  END
FROM "Target" AS t
WHERE r."targetId" = t."id";

UPDATE "Extension"
SET "recordKind" = 'port_artifact'
WHERE "slug" IN (
  'xmac-port-cva6-cvxif',
  'xmac-port-neorv32-cfu',
  'xmac-port-picorv32-pcpi',
  'xmac-port-rocket-rocc'
);

-- Attach each preserved artifact archive to the canonical XMAC Port.
UPDATE "Port" AS p
SET "artifactExtensionId" = artifact."id"
FROM "Extension" AS parent, "Extension" AS artifact, "Target" AS target
WHERE p."extensionId" = parent."id"
  AND p."targetId" = target."id"
  AND parent."slug" = 'xmac'
  AND artifact."slug" = CASE target."slug"
    WHEN 'cva6' THEN 'xmac-port-cva6-cvxif'
    WHEN 'neorv32' THEN 'xmac-port-neorv32-cfu'
    WHEN 'picorv32' THEN 'xmac-port-picorv32-pcpi'
    WHEN 'rocket' THEN 'xmac-port-rocket-rocc'
    ELSE NULL
  END;

DROP INDEX "Port_extensionId_targetId_key";
CREATE UNIQUE INDEX "Port_extensionId_targetId_backendSlug_key"
  ON "Port"("extensionId", "targetId", "backendSlug");
CREATE UNIQUE INDEX "Port_artifactExtensionId_key"
  ON "Port"("artifactExtensionId");
CREATE INDEX "Extension_recordKind_createdAt_idx"
  ON "Extension"("recordKind", "createdAt");

ALTER TABLE "Port" ADD CONSTRAINT "Port_artifactExtensionId_fkey"
  FOREIGN KEY ("artifactExtensionId") REFERENCES "Extension"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
