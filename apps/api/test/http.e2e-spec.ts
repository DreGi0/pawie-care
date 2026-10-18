import { Body, ConflictException, Controller, Get, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { IsString, MinLength } from 'class-validator';
import request from 'supertest';
import { Public } from '../src/auth/public.decorator.js';
import { createTestApp } from './create-test-app.js';

class GreetingBody {
  @IsString()
  @MinLength(2)
  name: string;
}

/** Routes that exist only in this test, to exercise the global HTTP behavior. */
@Public()
@Controller('probe')
class ProbeController {
  @Post('greetings')
  greet(@Body() body: GreetingBody) {
    return { greeting: `Hola, ${body.name}` };
  }

  @Get('conflict')
  conflict(): never {
    throw new ConflictException('Ese horario ya está tomado.', { errorCode: 'SLOT_TAKEN' });
  }

  @Get('crash')
  crash(): never {
    throw new Error('connection string postgresql://secret@db leaked');
  }

  @Get('limited')
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  limited() {
    return { ok: true };
  }
}

describe('HTTP layer', () => {
  let app: NestExpressApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp({ controllers: [ProbeController] });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('security headers', () => {
    it('sends the helmet headers and hides the framework', async () => {
      const response = await http().get('/v1/health').expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('CORS', () => {
    it('allows the configured origins, with credentials for the web cookies', async () => {
      const response = await http().get('/v1/health').set('Origin', 'https://web.pawie.test');

      expect(response.headers['access-control-allow-origin']).toBe('https://web.pawie.test');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('does not allow other origins', async () => {
      const response = await http().get('/v1/health').set('Origin', 'https://evil.test');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('request ID', () => {
    it('generates one when the caller does not send it', async () => {
      const response = await http().get('/v1/health');

      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('reuses a safe ID sent by the caller', async () => {
      const response = await http().get('/v1/health').set('X-Request-Id', 'mobile-42_abc');

      expect(response.headers['x-request-id']).toBe('mobile-42_abc');
    });

    it('replaces an ID that is unsafe to log', async () => {
      const response = await http().get('/v1/health').set('X-Request-Id', 'bad id; drop');

      expect(response.headers['x-request-id']).not.toBe('bad id; drop');
    });
  });

  describe('validation', () => {
    it('accepts a valid body', async () => {
      const response = await http().post('/v1/probe/greetings').send({ name: 'Luna' }).expect(201);

      expect(response.body).toEqual({ greeting: 'Hola, Luna' });
    });

    it('reports invalid fields in details', async () => {
      const response = await http().post('/v1/probe/greetings').send({ name: 'L' }).expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        errorCode: 'VALIDATION_FAILED',
        message: 'Revisa los datos enviados.',
        details: { name: [expect.any(String)] },
      });
    });

    it('rejects properties the DTO does not declare', async () => {
      const response = await http()
        .post('/v1/probe/greetings')
        .send({ name: 'Luna', isAdmin: true })
        .expect(400);

      expect(response.body.errorCode).toBe('VALIDATION_FAILED');
      expect(response.body.details).toHaveProperty('isAdmin');
    });

    it('rejects malformed JSON with the same error shape', async () => {
      const response = await http()
        .post('/v1/probe/greetings')
        .set('Content-Type', 'application/json')
        .send('{"name": ')
        .expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        errorCode: 'BAD_REQUEST',
        message: 'La solicitud no es válida.',
      });
    });
  });

  describe('errors', () => {
    it('keeps the code and Spanish message of business errors', async () => {
      const response = await http().get('/v1/probe/conflict').expect(409);

      expect(response.body).toEqual({
        statusCode: 409,
        errorCode: 'SLOT_TAKEN',
        message: 'Ese horario ya está tomado.',
      });
    });

    it('hides the details of unexpected errors', async () => {
      const response = await http().get('/v1/probe/crash').expect(500);

      expect(response.body).toEqual({
        statusCode: 500,
        errorCode: 'INTERNAL_SERVER_ERROR',
        message: 'Ocurrió un error inesperado. Intenta de nuevo más tarde.',
      });
      expect(JSON.stringify(response.body)).not.toContain('secret');
    });
  });

  describe('rate limiting', () => {
    it('answers 429 once a client goes over the limit', async () => {
      await http().get('/v1/probe/limited').expect(200);
      await http().get('/v1/probe/limited').expect(200);
      const response = await http().get('/v1/probe/limited').expect(429);

      expect(response.body).toEqual({
        statusCode: 429,
        errorCode: 'TOO_MANY_REQUESTS',
        message: 'Hiciste demasiadas solicitudes. Intenta de nuevo en un momento.',
      });
    });
  });
});
