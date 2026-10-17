import { NodeEnv, validateEnvironment } from './environment.js';

const DATABASE_URL = 'postgresql://pawie:pawie@localhost:5432/pawie';

describe('validateEnvironment', () => {
  it('applies defaults when only the required variables are set', () => {
    const environment = validateEnvironment({ DATABASE_URL });

    expect(environment).toMatchObject({
      NODE_ENV: NodeEnv.Development,
      PORT: 3000,
      DATABASE_URL,
      CORS_ORIGINS: [],
      LOG_LEVEL: 'info',
      TRUST_PROXY: 0,
    });
  });

  it('converts strings from the environment into numbers and lists', () => {
    const environment = validateEnvironment({
      DATABASE_URL,
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
    for (const name of ['DATABASE_URL', 'PORT', 'NODE_ENV', 'CORS_ORIGINS']) {
      expect(validate).toThrow(`- ${name}:`);
    }
  });

  it('rejects a database URL that is not PostgreSQL', () => {
    expect(() => validateEnvironment({ DATABASE_URL: 'mysql://root@localhost/pawie' })).toThrow(
      /DATABASE_URL/,
    );
  });
});
