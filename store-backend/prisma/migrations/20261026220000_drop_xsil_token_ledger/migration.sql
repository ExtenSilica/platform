-- Drop the XSIL governance ledger. API credentials (ApiToken) are unchanged.
DROP TABLE IF EXISTS "TokenGrant";
DROP TABLE IF EXISTS "TokenBalance";
DROP TYPE IF EXISTS "TokenGrantReason";
DROP TYPE IF EXISTS "TokenGrantStatus";
