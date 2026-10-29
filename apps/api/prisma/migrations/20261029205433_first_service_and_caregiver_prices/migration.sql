-- Written by hand over what Prisma generated, to keep the existing rows.

-- RN-PRE-01: the price now depends on the caregiver's level, not on the pet's, so a
-- caregiver has one price per service. Special-level rows are dropped; the standard
-- ones become the price.
DELETE FROM "caregiver_service_prices" WHERE "care_level" = 'SPECIAL';

-- DropIndex
DROP INDEX "caregiver_service_prices_service_id_care_level_idx";

-- AlterTable
ALTER TABLE "caregiver_service_prices" DROP CONSTRAINT "caregiver_service_prices_pkey",
DROP COLUMN "care_level",
ADD CONSTRAINT "caregiver_service_prices_pkey" PRIMARY KEY ("caregiver_id", "service_id");

-- CreateIndex
CREATE INDEX "caregiver_service_prices_service_id_idx" ON "caregiver_service_prices"("service_id");

-- RN-NIV-06: bookings that already exist take their caregiver's current level.
ALTER TABLE "bookings" ADD COLUMN "caregiver_level" "caregiver_level";
UPDATE "bookings" SET "caregiver_level" = "caregiver_profiles"."level"
  FROM "caregiver_profiles" WHERE "caregiver_profiles"."user_id" = "bookings"."caregiver_id";
ALTER TABLE "bookings" ALTER COLUMN "caregiver_level" SET NOT NULL,
ADD COLUMN "first_service_fee_waived" BOOLEAN NOT NULL DEFAULT false;

-- v0.5 prices (RN-PRE-01, RN-PRE-03, RN-PRE-04). The ranges change shape (by caregiver
-- level), so they are replaced; the fee and the commission only when they still hold the
-- v0.4 default, so a value someone set with settings:set stays.
UPDATE "settings" SET "value" = '{
  "HOME_VISIT": {
    "NEW": {"minCents": 600, "suggestedCents": 700, "maxCents": 900},
    "TRUSTED": {"minCents": 800, "suggestedCents": 1000, "maxCents": 1200},
    "PRO": {"minCents": 1100, "suggestedCents": 1300, "maxCents": 1500},
    "SUPER": {"minCents": 1500, "suggestedCents": 1700, "maxCents": 2000}
  },
  "OVERNIGHT_STAY": {
    "NEW": {"minCents": 1500, "suggestedCents": 1800, "maxCents": 2200},
    "TRUSTED": {"minCents": 2000, "suggestedCents": 2400, "maxCents": 2800},
    "PRO": {"minCents": 2600, "suggestedCents": 3000, "maxCents": 3500},
    "SUPER": {"minCents": 3200, "suggestedCents": 3800, "maxCents": 4500}
  }
}'::jsonb WHERE "key" = 'pricing.priceRanges';
UPDATE "settings" SET "value" = '1500'::jsonb
  WHERE "key" = 'pricing.ownerServiceFeeBp' AND "value" = '1000'::jsonb;
UPDATE "settings" SET "value" = '0'::jsonb
  WHERE "key" = 'pricing.caregiverCommissionBp' AND "value" = '1500'::jsonb;
