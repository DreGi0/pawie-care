import type { DistrictSlug } from '../seed/catalog.js';

// RN-MET-01: the targets, the thresholds and the time limits of the pilot report are
// constants of the report, not settings, so they aren't in §15 of the rules. The time
// limits are part of each metric's definition: the 15 days of RN-MET-04 don't follow
// the setting of RN-PRE-09.

/**
 * RN-MET-02: thresholds of the critical number. Red is the minimum acceptable, and it
 * already earns a reward, so below it is a fourth band.
 */
export const CRITICAL_NUMBER_THRESHOLDS = { red: 15, green: 25, superGreen: 35 } as const;

/** RN-MET-02: the districts of the pilot. */
export const PILOT_DISTRICTS: readonly DistrictSlug[] = ['san-salvador', 'santa-tecla'];

/** RN-MET-05, in basis points. */
export const SUPPLY_TARGET_BP = 6000;

/** RN-MET-04, in basis points, and its time limit since the owner signs up. */
export const VALUE_TARGET_BP = 2000;
export const VALUE_WINDOW_DAYS = 15;

/** RN-MET-06, in basis points. */
export const GROWTH_TARGET_BP = 5000;

/** RN-MET-07, in basis points, and its time limit since the owner's first payment. */
export const RETENTION_TARGET_BP = 4000;
export const RETENTION_WINDOW_DAYS = 60;

/** RN-MET-01: the seed's test accounts don't count. They all use this reserved domain. */
export const SEED_EMAIL_DOMAIN = '@example.com';
