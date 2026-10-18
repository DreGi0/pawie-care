import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    templateDatabase: string;
  }
}

// Same image as docker-compose.yml, so tests run against the version we develop on.
const POSTGRES_IMAGE = 'postgres:18-alpine';

// Copy of the migrated database that test files clone with createTestDatabase(). No
// one connects to it, because PostgreSQL can only clone a database nobody is using.
const TEMPLATE_DATABASE = 'migrated_template';

/** Starts one PostgreSQL for the whole integration run and applies the migrations. */
export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const databaseUrl = container.getConnectionUri();

  // Run the Prisma CLI through Node instead of a shell, so it works the same on Windows.
  const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });

  const { exitCode, output } = await container.exec([
    'psql',
    '--username',
    container.getUsername(),
    '--dbname',
    'postgres',
    '--command',
    `CREATE DATABASE "${TEMPLATE_DATABASE}" TEMPLATE "${container.getDatabase()}"`,
  ]);
  if (exitCode !== 0) {
    throw new Error(`Could not create the template database: ${output}`);
  }

  project.provide('databaseUrl', databaseUrl);
  project.provide('templateDatabase', TEMPLATE_DATABASE);

  return async () => {
    await container.stop();
  };
}
