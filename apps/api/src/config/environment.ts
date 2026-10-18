import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

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

  /** Signs the access tokens (HS256). */
  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  /** Lifetime of an access token, in seconds. */
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(24 * 60 * 60)
  JWT_ACCESS_TTL_SECONDS = 15 * 60;

  /** Lifetime of a refresh token, in days. Each use replaces it with a new one. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  REFRESH_TOKEN_TTL_DAYS = 30;

  /** Redis for the BullMQ queues: booking deadlines and maintenance (docs/arquitectura.md §4.10). */
  @IsUrl({ protocols: ['redis', 'rediss'], require_tld: false, require_protocol: true })
  REDIS_URL: string;

  /** S3-compatible storage the API talks to: SeaweedFS locally, Cloudflare R2 deployed. */
  @IsUrl({ protocols: ['http', 'https'], require_tld: false, require_protocol: true })
  S3_ENDPOINT: string;

  /**
   * Host the apps download and upload from, used to sign the URLs. Defaults to
   * S3_ENDPOINT; the Android emulator needs http://10.0.2.2:8333 instead of localhost.
   */
  @Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_tld: false, require_protocol: true })
  S3_PUBLIC_ENDPOINT?: string;

  /** R2 uses "auto"; SeaweedFS takes any region. */
  @IsString()
  S3_REGION = 'auto';

  @IsString()
  @MinLength(3)
  S3_BUCKET: string;

  @IsString()
  @MinLength(1)
  S3_ACCESS_KEY_ID: string;

  @IsString()
  @MinLength(1)
  S3_SECRET_ACCESS_KEY: string;

  /** Password of the demo owner that the seed creates. Without it, the seed skips the owner. */
  @Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString()
  @MinLength(8)
  DEMO_OWNER_PASSWORD?: string;
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
