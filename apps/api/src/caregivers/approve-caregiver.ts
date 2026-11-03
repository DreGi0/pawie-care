// Entry point of `pnpm caregivers:approve`, which compiles the API and runs this file
// from dist/. See approve-caregiver.command.ts.
import { PrismaService } from '../prisma/prisma.service.js';
import { runScript } from '../scripts/run-script.js';
import { approveCaregiverCommand } from './approve-caregiver.command.js';

await runScript((app) => approveCaregiverCommand(process.argv.slice(2), app.get(PrismaService)));
