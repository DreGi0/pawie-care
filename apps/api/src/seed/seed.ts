// Entry point of `pnpm db:seed`, which compiles the API and runs this file from dist/
// through `prisma db seed` (see prisma.config.ts). See seed-database.ts.
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/environment.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { runScript } from '../scripts/run-script.js';
import { SettingsService } from '../settings/settings.service.js';
import { seedDatabase } from './seed-database.js';

await runScript(async (app) => {
  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  const summary = await seedDatabase(app.get(PrismaService), app.get(SettingsService), {
    demoOwnerPassword: config.get('DEMO_OWNER_PASSWORD', { infer: true }),
  });
  console.log(
    `Seed listo: ${summary.districts} distritos, ${summary.species} especies, ` +
      `${summary.services} servicios y ${summary.caregivers} cuidadores.`,
  );
  console.log(
    summary.demoOwner
      ? `Dueño de demo: ${summary.demoOwner}, con la contraseña de DEMO_OWNER_PASSWORD.`
      : 'No se creó el dueño de demo porque falta DEMO_OWNER_PASSWORD.',
  );
  console.log(
    summary.createdSettings.length > 0
      ? `Parámetros creados con su valor inicial: ${summary.createdSettings.join(', ')}.`
      : 'Los parámetros ya existían y conservan su valor.',
  );
  return 0;
});
