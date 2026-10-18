import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { createTestDatabase, type TestDatabase } from '../database.js';

const run = promisify(execFile);

describe('migrations', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  // Fails when schema.prisma changed without a migration, and also when Prisma would
  // try to drop what the hand-written migration adds (the exclusion constraint, the
  // CHECK constraints and the partial indexes), which is what `migrate dev` would do.
  // It starts the Prisma CLI, which takes several seconds while other files run.
  it('leave the database exactly as schema.prisma describes it', { timeout: 60_000 }, async () => {
    const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');
    const diff = run(
      process.execPath,
      [
        prismaCli,
        'migrate',
        'diff',
        '--from-config-datasource',
        '--to-schema',
        'prisma/schema.prisma',
        '--script',
        '--exit-code',
      ],
      { env: { ...process.env, DATABASE_URL: db.url } },
    );

    // Exit code 2 means the diff isn't empty; stdout has the SQL Prisma would run.
    await expect(diff).resolves.toMatchObject({ stdout: expect.stringContaining('empty') });
  });
});
