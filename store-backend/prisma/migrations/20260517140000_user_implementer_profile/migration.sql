-- PR-B1: optional implementer identity on User
ALTER TABLE "User" ADD COLUMN "implementerGithubUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "implementerBio" TEXT;
