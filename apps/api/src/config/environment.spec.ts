import { NodeEnv, validateEnvironment } from './environment.js';

const DATABASE_URL = 'postgresql://pawie:pawie@localhost:5432/pawie';
const JWT_ACCESS_SECRET = 'a-secret-for-the-unit-tests-of-environment';
const REQUIRED = {
  DATABASE_URL,
  JWT_ACCESS_SECRET,
  S3_ENDPOINT: 'http://localhost:8333',
  S3_BUCKET: 'pawie-files',
  S3_ACCESS_KEY_ID: 'pawie',
  S3_SECRET_ACCESS_KEY: 'secret',
};

describe('validateEnvironment', () => {
  it('applies defaults when only the required variables are set', () => {
    const environment = validateEnvironment(REQUIRED);

    expect(environment).toMatchObject({
      NODE_ENV: NodeEnv.Development,
      PORT: 3000,
      DATABASE_URL,
      CORS_ORIGINS: [],
      LOG_LEVEL: 'info',
      TRUST_PROXY: 0,
      JWT_ACCESS_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_DAYS: 30,
    });
    expect(environment.DEMO_OWNER_PASSWORD).toBeUndefined();
  });

  it('converts strings from the environment into numbers and lists', () => {
    const environment = validateEnvironment({
      ...REQUIRED,
      PORT: '8080',
      TRUST_PROXY: '1',
      CORS_ORIGINS: 'http://localhost:3001, https://pawie.example ,',
    });

    expect(environment.PORT).toBe(8080);
    expect(environment.TRUST_PROXY).toBe(1);
    expect(environment.CORS_ORIGINS).toEqual(['http://localhost:3001', 'https://pawie.example']);
  });

  it('fails naming every missing or invalid variable', () => {
    const validate = () =>
      validateEnvironment({ PORT: 'abc', NODE_ENV: 'staging', CORS_ORIGINS: 'not-a-url' });

    expect(validate).toThrow('Invalid environment variables');
    for (const name of ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'PORT', 'NODE_ENV', 'CORS_ORIGINS']) {
      expect(validate).toThrow(`- ${name}:`);
    }
  });

  it('rejects a database URL that is not PostgreSQL', () => {
    expect(() =>
      validateEnvironment({ ...REQUIRED, DATABASE_URL: 'mysql://root@localhost/pawie' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('rejects a short JWT secret, which could be guessed', () => {
    expect(() => validateEnvironment({ ...REQUIRED, JWT_ACCESS_SECRET: 'short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('treats an empty demo owner password as not set', () => {
    expect(
      validateEnvironment({ ...REQUIRED, DEMO_OWNER_PASSWORD: '' }).DEMO_OWNER_PASSWORD,
    ).toBeUndefined();
    expect(() => validateEnvironment({ ...REQUIRED, DEMO_OWNER_PASSWORD: 'corta' })).toThrow(
      /DEMO_OWNER_PASSWORD/,
    );
  });
});
