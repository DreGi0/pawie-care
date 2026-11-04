-- Stage 8: the walk (docs/plan-v0.6.md). Written by hand over what Prisma generated.
-- The services row comes from the seed, like the other services.

-- RN-SER-05
ALTER TYPE "service_code" ADD VALUE 'WALK';

-- RN-PRE-01: the walk's ranges join the ones that already exist. Only when they are
-- missing, so it never undoes a settings:set; the JSON key doesn't use the new enum
-- value, so it can run in the same migration.
UPDATE "settings" SET "value" = "value" || '{
  "WALK": {
    "NEW": {"minCents": 300, "suggestedCents": 400, "maxCents": 500},
    "TRUSTED": {"minCents": 500, "suggestedCents": 650, "maxCents": 800},
    "PRO": {"minCents": 900, "suggestedCents": 1100, "maxCents": 1400},
    "SUPER": {"minCents": 1500, "suggestedCents": 1800, "maxCents": 2200}
  }
}'::jsonb
WHERE "key" = 'pricing.priceRanges' AND NOT ("value" ? 'WALK');
