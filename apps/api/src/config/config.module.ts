import { ConfigModule } from '@nestjs/config';
import { NodeEnv, validateEnvironment } from './environment.js';

/** Validated environment, shared by the API and the command-line scripts. */
export const AppConfigModule = ConfigModule.forRoot({
  isGlobal: true,
  cache: true,
  validate: validateEnvironment,
  // Tests set their variables explicitly, so a developer's .env can't change them.
  ignoreEnvFile: process.env.NODE_ENV === NodeEnv.Test,
});
