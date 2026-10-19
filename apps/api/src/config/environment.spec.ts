import { NodeEnv, validateEnvironment, wompiSettings } from './environment.js';

const DATABASE_URL = 'postgresql://pawie:pawie@localhost:5432/pawie';
const JWT_ACCESS_SECRET = 'a-secret-for-the-unit-tests-of-environment';
const REQUIRED = {
  DATABASE_URL,
  JWT_ACCESS_SECRET,
  REDIS_URL: 'redis://localhost:6379',
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
    for (const name of [
      'DATABASE_URL',
      'JWT_ACCESS_SECRET',
      'REDIS_URL',
      'PORT',
      'NODE_ENV',
      'CORS_ORIGINS',
    ]) {
      expect(validate).toThrow(`- ${name}:`);
    }
  });

  it('rejects a Redis URL that is not Redis', () => {
    expect(() => validateEnvironment({ ...REQUIRED, REDIS_URL: 'http://localhost:6379' })).toThrow(
      /REDIS_URL/,
    );
    expect(validateEnvironment({ ...REQUIRED, REDIS_URL: 'rediss://cache:6380' }).REDIS_URL).toBe(
      'rediss://cache:6380',
    );
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

  it('takes a Salvadoran phone for the demo caregivers, or none', () => {
    expect(
      validateEnvironment({ ...REQUIRED, DEMO_CAREGIVER_PHONE: '' }).DEMO_CAREGIVER_PHONE,
    ).toBeUndefined();
    expect(
      validateEnvironment({ ...REQUIRED, DEMO_CAREGIVER_PHONE: '+503 2200 0000' })
        .DEMO_CAREGIVER_PHONE,
    ).toBe('+503 2200 0000');
    expect(() => validateEnvironment({ ...REQUIRED, DEMO_CAREGIVER_PHONE: '123' })).toThrow(
      /DEMO_CAREGIVER_PHONE/,
    );
  });

  describe('Wompi', () => {
    const WOMPI = {
      WOMPI_APP_ID: 'app-id',
      WOMPI_API_SECRET: 'api-secret',
      PUBLIC_API_URL: 'https://pawie.trycloudflare.com/',
    };

    it('turns payments off when none of its variables is set', () => {
      expect(wompiSettings(validateEnvironment(REQUIRED))).toBeNull();
      expect(
        wompiSettings(
          validateEnvironment({
            ...REQUIRED,
            WOMPI_APP_ID: '',
            WOMPI_API_SECRET: '',
            PUBLIC_API_URL: '',
          }),
        ),
      ).toBeNull();
    });

    it('takes the credentials and the public URL, without its trailing slash', () => {
      expect(wompiSettings(validateEnvironment({ ...REQUIRED, ...WOMPI }))).toEqual({
        appId: 'app-id',
        apiSecret: 'api-secret',
        publicApiUrl: 'https://pawie.trycloudflare.com',
      });
    });

    it('needs all three once one is set', () => {
      const validate = () => validateEnvironment({ ...REQUIRED, WOMPI_APP_ID: 'app-id' });

      expect(validate).toThrow(/WOMPI_API_SECRET/);
      expect(validate).toThrow(/PUBLIC_API_URL/);
    });

    it('rejects a public URL that is not HTTPS, which Wompi could not call safely', () => {
      expect(() =>
        validateEnvironment({ ...REQUIRED, ...WOMPI, PUBLIC_API_URL: 'http://localhost:3000' }),
      ).toThrow(/PUBLIC_API_URL/);
    });
  });
});
