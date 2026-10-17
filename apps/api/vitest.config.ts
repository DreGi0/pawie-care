import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts'],
          // Decorators from class-validator and class-transformer need it; in the
          // app, @nestjs/core loads it.
          setupFiles: ['reflect-metadata'],
        },
      },
      {
        // Runs against a real PostgreSQL started with Testcontainers (needs Docker).
        extends: true,
        test: {
          name: 'integration',
          include: ['test/**/*.e2e-spec.ts'],
          globalSetup: ['test/global-setup.ts'],
          setupFiles: ['test/setup-env.ts'],
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
