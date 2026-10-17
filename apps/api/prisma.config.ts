import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Since v7 the Prisma CLI doesn't load .env on its own. Variables already set in
// the environment take precedence over the file.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Runs from the compiled output, because Node can't run the generated client
    // from TypeScript. `pnpm db:seed` compiles first.
    seed: 'node dist/seed/seed.js',
  },
  datasource: {
    // Read through process.env instead of env() so commands that don't touch the
    // database, like `prisma generate`, also work without it (for example, in CI).
    url: process.env.DATABASE_URL ?? '',
  },
});
