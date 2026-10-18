import type { ConfigService } from '@nestjs/config';
import { type Environment, validateEnvironment } from '../src/config/environment.js';
import { StorageService } from '../src/files/storage.service.js';

/** The StorageService the API uses, pointed at the test SeaweedFS (see setup-env.ts). */
export function storageForTests(): StorageService {
  const environment = validateEnvironment(process.env);
  const config = {
    get: (key: keyof Environment) => environment[key],
  } as unknown as ConfigService<Environment, true>;
  return new StorageService(config);
}
