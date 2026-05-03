-- CreateTable
CREATE TABLE "ToolArtifact" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VersionToolDependency" (
    "id" SERIAL NOT NULL,
    "versionId" INTEGER NOT NULL,
    "toolArtifactId" INTEGER NOT NULL,
    "toolName" TEXT NOT NULL,
    "toolVersion" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "declaredUrl" TEXT NOT NULL,
    "declaredSha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VersionToolDependency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ToolArtifact_sha256_key" ON "ToolArtifact"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "ToolArtifact_storageKey_key" ON "ToolArtifact"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "ToolArtifact_name_version_platform_sha256_key" ON "ToolArtifact"("name", "version", "platform", "sha256");

-- CreateIndex
CREATE INDEX "ToolArtifact_name_version_platform_idx" ON "ToolArtifact"("name", "version", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "VersionToolDependency_versionId_toolName_toolVersion_platform_key" ON "VersionToolDependency"("versionId", "toolName", "toolVersion", "platform");

-- CreateIndex
CREATE INDEX "VersionToolDependency_toolArtifactId_idx" ON "VersionToolDependency"("toolArtifactId");

-- AddForeignKey
ALTER TABLE "ToolArtifact" ADD CONSTRAINT "ToolArtifact_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersionToolDependency" ADD CONSTRAINT "VersionToolDependency_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersionToolDependency" ADD CONSTRAINT "VersionToolDependency_toolArtifactId_fkey" FOREIGN KEY ("toolArtifactId") REFERENCES "ToolArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
