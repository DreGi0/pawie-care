import type { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Environment, type WompiSettings, wompiSettings } from '../config/environment.js';

/** Injects the WompiSettings, or null when payments are off. */
export const WOMPI_SETTINGS = Symbol('WOMPI_SETTINGS');

export const wompiSettingsProvider: FactoryProvider<WompiSettings | null> = {
  provide: WOMPI_SETTINGS,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Environment, true>) =>
    wompiSettings({
      WOMPI_APP_ID: config.get('WOMPI_APP_ID', { infer: true }),
      WOMPI_API_SECRET: config.get('WOMPI_API_SECRET', { infer: true }),
      PUBLIC_API_URL: config.get('PUBLIC_API_URL', { infer: true }),
    }),
};
