import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createTestApp } from './create-test-app.js';

describe('API documentation', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves Swagger UI at /docs', async () => {
    const response = await request(app.getHttpServer()).get('/docs').redirects(1).expect(200);

    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('swagger-ui');
  });

  it('serves the OpenAPI document with versioned paths and stable operation IDs', async () => {
    const response = await request(app.getHttpServer()).get('/docs/openapi.json').expect(200);

    expect(response.body.openapi).toMatch(/^3\./);
    expect(response.body.paths['/v1/health'].get.operationId).toBe('Health_check');
    expect(response.body.components.schemas).toHaveProperty('ErrorResponse');
  });

  it('marks which routes need the access token', async () => {
    const { body } = await request(app.getHttpServer()).get('/docs/openapi.json').expect(200);

    expect(body.components.securitySchemes.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
    expect(body.paths['/v1/users/me'].get.security).toEqual([{ bearer: [] }]);
    expect(body.paths['/v1/auth/login'].post.security).toBeUndefined();
    expect(body.paths['/v1/health'].get.security).toBeUndefined();
  });
});
