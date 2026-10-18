import { isDeepStrictEqual } from 'node:util';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InvalidSettingValueError } from './setting-parsers.js';
import {
  parseSettingValue,
  SETTING_KEYS,
  SETTINGS,
  type SettingKey,
  type SettingValue,
} from './settings.registry.js';

export interface SettingChangeAuthor {
  /** "seed", the name given to the settings:set script, or an admin after the demo. */
  changedBy: string;
  reason?: string;
}

export interface SettingUpdate<K extends SettingKey> {
  /** What was stored before, as stored. Null if the setting didn't exist. */
  previousValue: Prisma.JsonValue | null;
  value: SettingValue<K>;
  /** False when the new value was the same as the stored one, so nothing was written. */
  changed: boolean;
}

/** The values of several settings, by key. */
export type SettingValues<K extends readonly SettingKey[]> = {
  [P in K[number]]: SettingValue<P>;
};

/** Reads and changes the configurable parameters (§15), always through the registry. */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The current value. Throws if the setting is missing or its stored value is no
   * longer valid, because nothing should run with a broken price or deadline.
   */
  async get<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    if (!setting) {
      throw missingSetting(key);
    }
    return parseSettingValue(key, setting.value);
  }

  /** Several values in one query, each one validated as get() does. */
  async getMany<const K extends readonly SettingKey[]>(keys: K): Promise<SettingValues<K>> {
    const settings = await this.prisma.setting.findMany({ where: { key: { in: [...keys] } } });
    const stored = new Map(settings.map(({ key, value }) => [key, value]));
    return Object.fromEntries(
      keys.map((key) => {
        if (!stored.has(key)) {
          throw missingSetting(key);
        }
        return [key, parseSettingValue(key, stored.get(key))];
      }),
    ) as SettingValues<K>;
  }

  /** Validates and saves a value, recording the change in setting_changes. */
  async set<K extends SettingKey>(
    key: K,
    value: unknown,
    { changedBy, reason }: SettingChangeAuthor,
  ): Promise<SettingUpdate<K>> {
    const parsed = parseSettingValue(key, value);
    const json = parsed as Prisma.InputJsonValue;

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.setting.findUnique({ where: { key } });
      if (current && isDeepStrictEqual(current.value, parsed)) {
        return { previousValue: current.value, value: parsed, changed: false };
      }

      await tx.setting.upsert({
        where: { key },
        create: { key, value: json },
        update: { value: json },
      });
      await tx.settingChange.create({
        data: {
          settingKey: key,
          previousValue: current ? (current.value as Prisma.InputJsonValue) : Prisma.DbNull,
          newValue: json,
          changedBy,
          reason,
        },
      });
      return { previousValue: current?.value ?? null, value: parsed, changed: true };
    });
  }

  /**
   * Creates the settings that don't exist yet with their initial value, leaving the
   * others as they are. Returns the keys it created.
   */
  async createMissing(author: SettingChangeAuthor): Promise<SettingKey[]> {
    const existing = await this.prisma.setting.findMany({ select: { key: true } });
    const existingKeys = new Set(existing.map(({ key }) => key));
    const missing = SETTING_KEYS.filter((key) => !existingKeys.has(key));
    for (const key of missing) {
      await this.set(key, SETTINGS[key].initialValue, author);
    }
    return missing;
  }
}

function missingSetting(key: SettingKey): InvalidSettingValueError {
  return new InvalidSettingValueError(`Falta el parámetro ${key}. Corre el seed: pnpm db:seed.`);
}
