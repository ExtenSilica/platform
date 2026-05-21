ALTER TYPE "GovernancePointReason" ADD VALUE IF NOT EXISTS 'first_package_published';
ALTER TYPE "GovernancePointReason" ADD VALUE IF NOT EXISTS 'verification_run_passed';
ALTER TYPE "GovernancePointReason" ADD VALUE IF NOT EXISTS 'external_citation_verified';
ALTER TYPE "GovernancePointReason" ADD VALUE IF NOT EXISTS 'cli_contribution_merged';
ALTER TYPE "GovernancePointReason" ADD VALUE IF NOT EXISTS 'vendor_official_claim';
ALTER TYPE "GovernancePointReason" ADD VALUE IF NOT EXISTS 'security_issue_reported';
ALTER TYPE "GovernancePointReason" ADD VALUE IF NOT EXISTS 'admin_grant';
