import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer, Wait } from 'testcontainers';
import type { TestProject } from 'vitest/node';
import { TEST_S3 } from './test-s3.js';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    templateDatabase: string;
    s3Endpoint: string;
  }
}

// Same images as docker-compose.yml, so tests run against the versions we develop on.
const POSTGRES_IMAGE = 'postgres:18-alpine';
const SEAWEEDFS_IMAGE = 'chrislusf/seaweedfs:4.48';

// Copy of the migrated database that test files clone with createTestDatabase(). No
// one connects to it, because PostgreSQL can only clone a database nobody is using.
const TEMPLATE_DATABASE = 'migrated_template';

/**
 * Starts one PostgreSQL and one SeaweedFS for the whole integration run, and applies
 * the migrations.
 */
export default async function setup(project: TestProject) {
  const [postgres, seaweedfs] = await Promise.all([
    new PostgreSqlContainer(POSTGRES_IMAGE).start(),
    // `weed mini` creates the access key and the bucket from these variables.
    new GenericContainer(SEAWEEDFS_IMAGE)
      .withCommand(['mini', '-dir=/data'])
      .withEnvironment({
        AWS_ACCESS_KEY_ID: TEST_S3.accessKeyId,
        AWS_SECRET_ACCESS_KEY: TEST_S3.secretAccessKey,
        S3_BUCKET: TEST_S3.bucket,
      })
      .withExposedPorts(8333)
      .withWaitStrategy(Wait.forHttp('/healthz', 8333).forStatusCode(200))
      .start(),
  ]);
  const databaseUrl = postgres.getConnectionUri();

  // Run the Prisma CLI through Node instead of a shell, so it works the same on Windows.
  const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });

  const { exitCode, output } = await postgres.exec([
    'psql',
    '--username',
    postgres.getUsername(),
    '--dbname',
    'postgres',
    '--command',
    `CREATE DATABASE "${TEMPLATE_DATABASE}" TEMPLATE "${postgres.getDatabase()}"`,
  ]);
  if (exitCode !== 0) {
    throw new Error(`Could not create the template database: ${output}`);
  }

  project.provide('databaseUrl', databaseUrl);
  project.provide('templateDatabase', TEMPLATE_DATABASE);
  project.provide('s3Endpoint', `http://${seaweedfs.getHost()}:${seaweedfs.getMappedPort(8333)}`);

  return async () => {
    await Promise.all([postgres.stop(), seaweedfs.stop()]);
  };
}
