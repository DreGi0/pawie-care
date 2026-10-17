// Entry point of `pnpm settings:set`, which compiles the API and runs this file from
// dist/. See set-setting.command.ts.
import { runScript } from '../scripts/run-script.js';
import { setSettingCommand } from './set-setting.command.js';
import { SettingsService } from './settings.service.js';

await runScript((app) => setSettingCommand(process.argv.slice(2), app.get(SettingsService)));
