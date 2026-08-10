-- Preserve the abandoned portability proof of concept without presenting it as
-- a public RISC-V extension. Port artifacts remain addressable to the registry
-- internally, while recordKind keeps them out of catalog lists and metrics.
UPDATE "Extension"
SET
  "recordKind" = 'port_artifact',
  "name" = 'XMAC (archived experiment)',
  "description" = 'Archived ExtenSilica portability experiment preserved for historical reference. It is not part of the public extension catalog.',
  "shortDescription" = 'Archived internal experiment; not part of the public extension catalog.',
  "longDescription" = NULL,
  "keywords" = 'archived,internal,experiment',
  "isDeprecated" = TRUE,
  "deprecationMessage" = 'Archived internal experiment. XMAC is not part of the ExtenSilica public extension catalog.'
WHERE "slug" = 'xmac';
