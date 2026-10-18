import { randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { inject } from 'vitest';
import type { Environment } from '../src/config/environment.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/** A database of its own for a test file, with the migrations applied and no data. */
export interface TestDatabase {
  url: string;
  prisma: PrismaService;
  close(): Promise<void>;
}

/**
 * Clones the migrated template database (see global-setup.ts), so test files that
 * write data can run in parallel without seeing each other's rows. The databases go
 * away with the container.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const name = `test_${randomUUID().replaceAll('-', '')}`;
  const admin = prismaFor(withDatabase(inject('databaseUrl'), 'postgres'));
  try {
    await admin.$executeRawUnsafe(
      `CREATE DATABASE "${name}" TEMPLATE "${inject('templateDatabase')}"`,
    );
  } finally {
    await admin.$disconnect();
  }

  const url = withDatabase(inject('databaseUrl'), name);
  const prisma = prismaFor(url);
  return { url, prisma, close: () => prisma.$disconnect() };
}

/** The same PrismaService the API uses, pointed at another database. */
export function prismaFor(databaseUrl: string): PrismaService {
  const config = { get: () => databaseUrl } as unknown as ConfigService<Environment, true>;
  return new PrismaService(config);
}

function withDatabase(databaseUrl: string, database: string): string {
  const url = new URL(databaseUrl);
  url.pathname = `/${database}`;
  return url.toString();
}
