import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ExtenSilica XSIL Registry API',
      version: '3.0.0',
      description:
        'Public registry API for `.xsil` packages: catalog, versions, download stats, reviews, ' +
        'and implementation coordination (request → implement → verify).',
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Local development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'API token from POST /auth/login or POST /auth/me/tokens',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        ImplementationRequestStatus: {
          type: 'string',
          enum: ['draft', 'open', 'in_progress', 'submitted', 'verified', 'completed', 'cancelled'],
        },
        ImplementationRequestVisibility: {
          type: 'string',
          enum: ['public', 'org_only', 'unlisted'],
        },
        ImplementationSubmissionStatus: {
          type: 'string',
          enum: ['draft', 'submitted'],
        },
        VerificationRunOutcome: {
          type: 'string',
          enum: ['pass', 'fail'],
        },
        ImplementationRequestPackageRef: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            slug: { type: 'string' },
            name: { type: 'string' },
            ownerId: { type: 'integer', nullable: true },
            orgId: { type: 'integer', nullable: true },
          },
        },
        ImplementationUserRef: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            username: { type: 'string' },
            avatarUrl: { type: 'string', nullable: true },
            implementerGithubUrl: { type: 'string', nullable: true },
          },
        },
        ImplementationOrgRef: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            slug: { type: 'string' },
            displayName: { type: 'string' },
          },
        },
        ImplementationMilestone: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            sortOrder: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ImplementationMilestoneInput: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string', minLength: 3, maxLength: 200 },
            description: { type: 'string', maxLength: 2000 },
            sortOrder: { type: 'integer' },
          },
        },
        ImplementationRequest: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            packageId: { type: 'integer' },
            createdByUserId: { type: 'integer' },
            createdByOrgId: { type: 'integer', nullable: true },
            title: { type: 'string' },
            description: { type: 'string' },
            visibility: { $ref: '#/components/schemas/ImplementationRequestVisibility' },
            status: { $ref: '#/components/schemas/ImplementationRequestStatus' },
            targetCapability: { type: 'string', nullable: true },
            acceptanceCriteriaSummary: { type: 'string', nullable: true },
            fundingContactEmail: { type: 'string', nullable: true },
            fundingNote: { type: 'string', nullable: true },
            assignedImplementerUserId: { type: 'integer', nullable: true },
            openedAt: { type: 'string', format: 'date-time', nullable: true },
            completedAt: { type: 'string', format: 'date-time', nullable: true },
            cancelledAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            package: { $ref: '#/components/schemas/ImplementationRequestPackageRef' },
            createdBy: { $ref: '#/components/schemas/ImplementationUserRef' },
            createdByOrg: { $ref: '#/components/schemas/ImplementationOrgRef', nullable: true },
            assignedImplementer: { $ref: '#/components/schemas/ImplementationUserRef', nullable: true },
            milestones: {
              type: 'array',
              items: { $ref: '#/components/schemas/ImplementationMilestone' },
            },
            interestCount: { type: 'integer' },
            submissionCount: { type: 'integer' },
          },
        },
        CreateImplementationRequestBody: {
          type: 'object',
          required: ['title', 'description'],
          properties: {
            title: { type: 'string', minLength: 5, maxLength: 200 },
            description: { type: 'string', minLength: 50, maxLength: 10000 },
            visibility: { $ref: '#/components/schemas/ImplementationRequestVisibility' },
            targetCapability: { type: 'string', maxLength: 120 },
            acceptanceCriteriaSummary: { type: 'string', maxLength: 4000 },
            fundingContactEmail: { type: 'string', format: 'email' },
            fundingNote: { type: 'string', maxLength: 2000 },
            createdByOrgId: { type: 'integer', description: 'File on behalf of an org (member required)' },
          },
        },
        PatchImplementationRequestBody: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 5, maxLength: 200 },
            description: { type: 'string', minLength: 50, maxLength: 10000 },
            visibility: { $ref: '#/components/schemas/ImplementationRequestVisibility' },
            status: { $ref: '#/components/schemas/ImplementationRequestStatus' },
            targetCapability: { type: 'string', maxLength: 120, nullable: true },
            acceptanceCriteriaSummary: { type: 'string', maxLength: 4000, nullable: true },
            fundingContactEmail: { type: 'string', format: 'email', nullable: true },
            fundingNote: { type: 'string', maxLength: 2000, nullable: true },
            assignedImplementerUserId: { type: 'integer', nullable: true },
          },
        },
        VerificationRun: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            outcome: { $ref: '#/components/schemas/VerificationRunOutcome' },
            notes: { type: 'string', nullable: true },
            logUrl: { type: 'string', nullable: true },
            verifierId: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ImplementationSubmission: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            requestId: { type: 'integer' },
            submittedById: { type: 'integer' },
            status: { $ref: '#/components/schemas/ImplementationSubmissionStatus' },
            summary: { type: 'string' },
            evidenceUrl: { type: 'string', nullable: true },
            versionId: { type: 'integer', nullable: true },
            submittedAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            submittedBy: { $ref: '#/components/schemas/ImplementationUserRef' },
            verificationRuns: {
              type: 'array',
              items: { $ref: '#/components/schemas/VerificationRun' },
            },
          },
        },
        CreateImplementationSubmissionBody: {
          type: 'object',
          required: ['summary'],
          properties: {
            summary: { type: 'string', minLength: 50, maxLength: 10000 },
            evidenceUrl: { type: 'string', format: 'uri', description: 'HTTPS URL' },
            versionId: { type: 'integer', description: 'Published package version id' },
          },
        },
        PatchImplementationSubmissionBody: {
          type: 'object',
          properties: {
            summary: { type: 'string', minLength: 50, maxLength: 10000 },
            evidenceUrl: { type: 'string', format: 'uri', nullable: true },
            status: { type: 'string', enum: ['submitted'] },
          },
        },
        CreateVerificationRunBody: {
          type: 'object',
          required: ['outcome'],
          properties: {
            outcome: { $ref: '#/components/schemas/VerificationRunOutcome' },
            notes: { type: 'string', maxLength: 4000 },
            logUrl: { type: 'string', format: 'uri', description: 'HTTPS URL to CI logs' },
          },
        },
        UserContributions: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            requestsCreated: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  title: { type: 'string' },
                  status: { $ref: '#/components/schemas/ImplementationRequestStatus' },
                  packageSlug: { type: 'string' },
                  packageName: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
            submissions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  requestId: { type: 'integer' },
                  requestTitle: { type: 'string' },
                  packageSlug: { type: 'string' },
                  packageName: { type: 'string' },
                  status: { $ref: '#/components/schemas/ImplementationSubmissionStatus' },
                  submittedAt: { type: 'string', format: 'date-time', nullable: true },
                  latestVerificationOutcome: { $ref: '#/components/schemas/VerificationRunOutcome', nullable: true },
                },
              },
            },
            verifications: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  submissionId: { type: 'integer' },
                  requestId: { type: 'integer' },
                  requestTitle: { type: 'string' },
                  packageSlug: { type: 'string' },
                  packageName: { type: 'string' },
                  outcome: { $ref: '#/components/schemas/VerificationRunOutcome' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        Package: {
          type: 'object',
          properties: {
            id:               { type: 'integer' },
            slug:             { type: 'string' },
            name:             { type: 'string' },
            description:      { type: 'string' },
            shortDescription: { type: 'string' },
            author:           { type: 'string' },
            keywords:         { type: 'array', items: { type: 'string' } },
            license:          { type: 'string' },
            iconUrl:          { type: 'string' },
            repositoryUrl:    { type: 'string' },
            homepageUrl:      { type: 'string' },
            latestVersion:    { type: 'string' },
            totalDownloads:   { type: 'integer' },
            weeklyDownloads:  { type: 'integer' },
            reviewCount:      { type: 'integer' },
            averageRating:    { type: 'number' },
            isDeprecated:     { type: 'boolean' },
            createdAt:        { type: 'string', format: 'date-time' },
            updatedAt:        { type: 'string', format: 'date-time' },
            versions: {
              type: 'array',
              items: { $ref: '#/components/schemas/PackageVersion' },
            },
          },
        },
        PackageVersion: {
          type: 'object',
          properties: {
            id:              { type: 'integer' },
            version:         { type: 'string' },
            changelog:       { type: 'string' },
            xsilUrl:         { type: 'string' },
            checksum:        { type: 'string', description: 'SHA-256 of the full .xsil archive' },
            checksumPayload: { type: 'string', description: 'SHA-256 of non-manifest files' },
            isa:             { type: 'string' },
            toolchain:       { type: 'string' },
            targets:         { type: 'string', description: 'JSON blob of manifest targets' },
            size:            { type: 'integer' },
            downloadCount:   { type: 'integer' },
            isYanked:        { type: 'boolean' },
            yankReason:      { type: 'string' },
            publishedAt:     { type: 'string', format: 'date-time' },
          },
        },
        Review: {
          type: 'object',
          properties: {
            id:        { type: 'integer' },
            userId:    { type: 'integer' },
            username:  { type: 'string' },
            rating:    { type: 'integer', minimum: 1, maximum: 5 },
            comment:   { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PackageStats: {
          type: 'object',
          properties: {
            slug:       { type: 'string' },
            allTime:    { type: 'integer' },
            last7Days:  { type: 'integer' },
            last30Days: { type: 'integer' },
            dailyHistory: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  day:   { type: 'string', format: 'date' },
                  count: { type: 'integer' },
                },
              },
            },
            byVersion: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  version:    { type: 'string' },
                  count90Days: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: [
    './src/routes/packages.ts',
    './src/routes/stats.ts',
    './src/routes/auth.ts',
    './src/swagger/implementationRequests.docs.ts',
  ],
};

export const specs = swaggerJsdoc(options);
