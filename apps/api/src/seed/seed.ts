// Entry point of `pnpm db:seed`, which compiles the API and runs this file from dist/
// through `prisma db seed` (see prisma.config.ts). See seed-database.ts.
import { PrismaService } from '../prisma/prisma.service.js';
import { runScript } from '../scripts/run-script.js';
import { SettingsService } from '../settings/settings.service.js';
import { seedDatabase } from './seed-database.js';

await runScript(async (app) => {
  const summary = await seedDatabase(app.get(PrismaService), app.get(SettingsService));
  console.log(
    `Seed listo: ${summary.districts} distritos, ${summary.species} especies, ` +
      `${summary.services} servicios y ${summary.caregivers} cuidadores.`,
  );
  console.log(
    summary.createdSettings.length > 0
      ? `Parámetros creados con su valor inicial: ${summary.createdSettings.join(', ')}.`
      : 'Los parámetros ya existían y conservan su valor.',
  );
  return 0;
});
