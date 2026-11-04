// Entry point of `pnpm metrics:report`, which compiles the API and runs this file from
// dist/. See metrics-report.command.ts.
import { PrismaService } from '../prisma/prisma.service.js';
import { runScript } from '../scripts/run-script.js';
import { metricsReportCommand } from './metrics-report.command.js';

await runScript((app) => metricsReportCommand(process.argv.slice(2), app.get(PrismaService)));
