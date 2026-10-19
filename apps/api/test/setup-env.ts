import { inject } from 'vitest';
import { TEST_WOMPI_API_SECRET } from './fake-wompi.js';
import { TEST_S3 } from './test-s3.js';

// AppModule validates the environment when it is imported, so these must be set
// before any test file imports it. With NODE_ENV=test the .env file is ignored.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = inject('databaseUrl');
process.env.CORS_ORIGINS = 'https://web.pawie.test';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_ACCESS_SECRET = 'integration-tests-secret-at-least-32-characters';
process.env.REDIS_URL = inject('redisUrl');
process.env.S3_ENDPOINT = inject('s3Endpoint');
process.env.S3_BUCKET = TEST_S3.bucket;
process.env.S3_ACCESS_KEY_ID = TEST_S3.accessKeyId;
process.env.S3_SECRET_ACCESS_KEY = TEST_S3.secretAccessKey;
// The tests replace the Wompi client with FakeWompi (fake-wompi.ts), so these never reach Wompi.
process.env.WOMPI_APP_ID = 'test-app-id';
process.env.WOMPI_API_SECRET = TEST_WOMPI_API_SECRET;
process.env.PUBLIC_API_URL = 'https://api.pawie.test';
