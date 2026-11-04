-- Stage 7: the full pet profile (docs/plan-v0.6.md). Written by hand over what Prisma
-- generated, to add the CHECK constraints.

-- CreateEnum
CREATE TYPE "pet_schedule_kind" AS ENUM ('MEAL', 'MEDICATION');

-- RN-MAS-02 (routine) and RN-MAS-11 (heat)
ALTER TABLE "pets" ADD COLUMN     "allowed_treats" TEXT,
ADD COLUMN     "daily_routine" TEXT,
ADD COLUMN     "food_description" TEXT,
ADD COLUMN     "food_portion" TEXT,
ADD COLUMN     "heat_ends_on" DATE,
ADD COLUMN     "heat_starts_on" DATE;

-- RN-MAS-11: heat has a start and an end, and only a female can be in heat.
ALTER TABLE "pets"
  ADD CONSTRAINT "pets_heat_check" CHECK (
    ("heat_starts_on" IS NULL) = ("heat_ends_on" IS NULL)
    AND "heat_ends_on" >= "heat_starts_on"
  ),
  ADD CONSTRAINT "pets_heat_sex_check" CHECK ("heat_starts_on" IS NULL OR "sex" = 'FEMALE');

-- CreateTable
CREATE TABLE "pet_schedule_items" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "pet_id" UUID NOT NULL,
    "kind" "pet_schedule_kind" NOT NULL,
    "minute_of_day" SMALLINT NOT NULL,
    "label" TEXT NOT NULL,
    "dose" TEXT,
    "care_need_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pet_schedule_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pet_schedule_items_minute_check" CHECK ("minute_of_day" BETWEEN 0 AND 1439),
    CONSTRAINT "pet_schedule_items_label_check" CHECK (btrim("label") <> ''),
    -- RN-CUI-12: a dose belongs to a MEDICATION care need, which gives its dates and
    -- its vet instructions. A meal has none. The API checks that the need's task is
    -- MEDICATION.
    CONSTRAINT "pet_schedule_items_care_need_check" CHECK (
      ("kind" = 'MEDICATION') = ("care_need_id" IS NOT NULL)
    )
);

-- CreateIndex
CREATE INDEX "pet_schedule_items_pet_id_idx" ON "pet_schedule_items"("pet_id");

-- CreateIndex
CREATE INDEX "pet_schedule_items_care_need_id_idx" ON "pet_schedule_items"("care_need_id");

-- CreateIndex
CREATE UNIQUE INDEX "pet_care_needs_id_pet_id_key" ON "pet_care_needs"("id", "pet_id");

-- AddForeignKey
ALTER TABLE "pet_schedule_items" ADD CONSTRAINT "pet_schedule_items_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: the care need must belong to the same pet, and deleting it deletes
-- its doses.
ALTER TABLE "pet_schedule_items" ADD CONSTRAINT "pet_schedule_items_care_need_id_pet_id_fkey" FOREIGN KEY ("care_need_id", "pet_id") REFERENCES "pet_care_needs"("id", "pet_id") ON DELETE CASCADE ON UPDATE CASCADE;
