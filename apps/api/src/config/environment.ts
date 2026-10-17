import { plainToInstance, Transform, Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsUrl, Max, Min, validateSync } from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * Environment variables the API reads. They are validated once at startup so a
 * missing or malformed value stops the app instead of failing later. Keep
 * apps/api/.env.example in sync with this class.
 */
export class Environment {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsUrl({ protocols: ['postgres', 'postgresql'], require_tld: false, require_protocol: true })
  DATABASE_URL: string;

  /** Comma-separated list of browser origins allowed by CORS. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
      : value,
  )
  @IsUrl(
    { protocols: ['http', 'https'], require_tld: false, require_protocol: true },
    { each: true },
  )
  CORS_ORIGINS: string[] = [];

  @IsIn(LOG_LEVELS)
  LOG_LEVEL: LogLevel = 'info';

  /** Number of reverse proxies in front of the API (Express "trust proxy"). */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  TRUST_PROXY = 0;
}

export function validateEnvironment(raw: Record<string, unknown>): Environment {
  const environment = plainToInstance(Environment, raw);
  const errors = validateSync(environment);
  if (errors.length > 0) {
    const details = errors
      .map((error) => `  - ${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${details}`);
  }
  return environment;
}
