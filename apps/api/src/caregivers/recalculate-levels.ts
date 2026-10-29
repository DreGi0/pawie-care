// Entry point of `pnpm caregivers:recalculate-levels`, which compiles the API and runs
// this file from dist/. See recalculate-level.ts.
import { PrismaService } from '../prisma/prisma.service.js';
import { runScript } from '../scripts/run-script.js';
import { SettingsService } from '../settings/settings.service.js';
import { recalculateAllLevels } from './recalculate-level.js';

await runScript(async (app) => {
  const changes = await recalculateAllLevels(app.get(PrismaService), app.get(SettingsService));
  for (const { caregiverId, from, to } of changes) {
    console.log(`${caregiverId}: ${from} → ${to}`);
  }
  console.log(
    changes.length > 0
      ? `Niveles recalculados: cambiaron ${changes.length}.`
      : 'Niveles recalculados: no cambió ninguno.',
  );
  return 0;
});
