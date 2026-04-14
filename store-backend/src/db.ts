import { PrismaClient } from '@prisma/client';

// Singleton Prisma client shared across all controllers.
export const prisma = new PrismaClient();
