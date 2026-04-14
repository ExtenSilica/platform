import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ExtenSilica XSIL Registry API',
      version: '3.0.0',
      description:
        'Public registry API for `.xsil` packages: catalog, versions, download stats, and reviews.',
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Local development server',
      },
    ],
    components: {
      schemas: {
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
  apis: ['./src/routes/packages.ts', './src/routes/stats.ts'],
};

export const specs = swaggerJsdoc(options);
