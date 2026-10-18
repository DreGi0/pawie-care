import { inject } from 'vitest';

// AppModule validates the environment when it is imported, so these must be set
// before any test file imports it. With NODE_ENV=test the .env file is ignored.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = inject('databaseUrl');
process.env.CORS_ORIGINS = 'https://web.pawie.test';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_ACCESS_SECRET = 'integration-tests-secret-at-least-32-characters';
