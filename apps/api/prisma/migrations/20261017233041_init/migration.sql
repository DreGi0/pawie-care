-- CreateEnum
CREATE TYPE "role" AS ENUM ('OWNER', 'CAREGIVER', 'ADMIN');

-- CreateEnum
CREATE TYPE "service_code" AS ENUM ('HOME_VISIT', 'OVERNIGHT_STAY');

-- CreateEnum
CREATE TYPE "caregiver_status" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "care_level" AS ENUM ('STANDARD', 'SPECIAL');

-- CreateEnum
CREATE TYPE "certification_status" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "pet_sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "care_task" AS ENUM ('MEDICATION', 'WOUND_CARE', 'POST_OPERATIVE_RECOVERY', 'SYRINGE_FEEDING', 'PRESCRIBED_REST', 'CHRONIC_CONDITION_MONITORING', 'MOBILITY_ASSISTANCE', 'INCONTINENCE_HYGIENE', 'INJECTION', 'IV_FLUIDS', 'STITCH_OR_DRAIN_REMOVAL', 'TUBE_PLACEMENT', 'SEDATION', 'DOSE_CHANGE', 'DIAGNOSIS_OR_PRESCRIPTION');

-- CreateEnum
CREATE TYPE "file_purpose" AS ENUM ('PET_PHOTO', 'CAREGIVER_PHOTO', 'VET_INSTRUCTION', 'VACCINATION_RECORD');

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('REQUESTED', 'PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'REJECTED', 'EXPIRED', 'CANCELLED_BY_OWNER', 'CANCELLED_BY_CAREGIVER', 'DISPUTED');

-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('WOMPI');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "birth_date" DATE NOT NULL,
    "roles" "role"[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "rotated_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "details" TEXT,
    "district_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "species" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "code" "service_code" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caregiver_profiles" (
    "user_id" UUID NOT NULL,
    "status" "caregiver_status" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "instant_booking" BOOLEAN NOT NULL DEFAULT false,
    "vet_student_until" DATE,
    "bio" TEXT,
    "photo_file_id" UUID,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "rating_sum" INTEGER NOT NULL DEFAULT 0,
    "special_rating_count" INTEGER NOT NULL DEFAULT 0,
    "special_rating_sum" INTEGER NOT NULL DEFAULT 0,
    "completed_booking_count" INTEGER NOT NULL DEFAULT 0,
    "suspended_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "caregiver_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "caregiver_districts" (
    "caregiver_id" UUID NOT NULL,
    "district_id" UUID NOT NULL,

    CONSTRAINT "caregiver_districts_pkey" PRIMARY KEY ("caregiver_id","district_id")
);

-- CreateTable
CREATE TABLE "caregiver_service_prices" (
    "caregiver_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "care_level" "care_level" NOT NULL,
    "price_cents" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "caregiver_service_prices_pkey" PRIMARY KEY ("caregiver_id","service_id","care_level")
);

-- CreateTable
CREATE TABLE "caregiver_availability" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "caregiver_id" UUID NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "start_minute" SMALLINT NOT NULL,
    "end_minute" SMALLINT NOT NULL,

    CONSTRAINT "caregiver_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certification_types" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "certification_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caregiver_certifications" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "caregiver_id" UUID NOT NULL,
    "certification_type_id" UUID NOT NULL,
    "status" "certification_status" NOT NULL DEFAULT 'ACTIVE',
    "obtained_on" DATE NOT NULL,
    "valid_until" DATE NOT NULL,
    "suspended_until" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "caregiver_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pets" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID NOT NULL,
    "species_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "breed" TEXT,
    "birth_date" DATE NOT NULL,
    "birth_date_is_approximate" BOOLEAN NOT NULL DEFAULT false,
    "sex" "pet_sex" NOT NULL,
    "weight_grams" INTEGER,
    "is_sterilized" BOOLEAN,
    "temperament" TEXT,
    "handling_notes" TEXT,
    "vet_name" TEXT,
    "vet_clinic" TEXT,
    "vet_phone" TEXT,
    "health_conditions" TEXT,
    "medications" TEXT,
    "photo_file_id" UUID,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet_vaccinations" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "pet_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "administered_on" DATE NOT NULL,
    "next_due_on" DATE,
    "file_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pet_vaccinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vet_instructions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "pet_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "issued_on" DATE NOT NULL,
    "vet_name" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vet_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet_care_needs" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "pet_id" UUID NOT NULL,
    "task" "care_task" NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "vet_instruction_id" UUID,
    "owner_instructions" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pet_care_needs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "uploaded_by_id" UUID NOT NULL,
    "purpose" "file_purpose" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER,
    "uploaded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "owner_id" UUID NOT NULL,
    "caregiver_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "care_level" "care_level" NOT NULL,
    "status" "booking_status" NOT NULL,
    "blocks_calendar" BOOLEAN NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "address_id" UUID,
    "district_id" UUID NOT NULL,
    "address_street" TEXT NOT NULL,
    "address_details" TEXT,
    "instructions" TEXT,
    "emergency_contact_name" TEXT NOT NULL,
    "emergency_contact_phone" TEXT NOT NULL,
    "emergency_vet_name" TEXT,
    "emergency_vet_phone" TEXT,
    "emergency_preauthorized_cents" INTEGER NOT NULL,
    "emergency_clinic_consent" BOOLEAN NOT NULL,
    "response_due_at" TIMESTAMPTZ(3),
    "payment_due_at" TIMESTAMPTZ(3),
    "subtotal_cents" INTEGER NOT NULL,
    "owner_service_fee_bp" INTEGER NOT NULL,
    "owner_service_fee_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "caregiver_commission_bp" INTEGER NOT NULL,
    "caregiver_commission_cents" INTEGER NOT NULL,
    "caregiver_payout_cents" INTEGER NOT NULL,
    "additional_pet_surcharge_bp" INTEGER NOT NULL,
    "guarantee_fund_bp" INTEGER NOT NULL,
    "vat_bp" INTEGER NOT NULL,
    "gateway_fee_bp" INTEGER NOT NULL,
    "pricing_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_pets" (
    "booking_id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "care_level" "care_level" NOT NULL,

    CONSTRAINT "booking_pets_pkey" PRIMARY KEY ("booking_id","pet_id")
);

-- CreateTable
CREATE TABLE "booking_vet_instructions" (
    "booking_id" UUID NOT NULL,
    "vet_instruction_id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,

    CONSTRAINT "booking_vet_instructions_pkey" PRIMARY KEY ("booking_id","vet_instruction_id")
);

-- CreateTable
CREATE TABLE "booking_slots" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "booking_id" UUID NOT NULL,
    "caregiver_id" UUID NOT NULL,
    "blocks_calendar" BOOLEAN NOT NULL,
    "service_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "unit_price_cents" INTEGER NOT NULL,
    "subtotal_cents" INTEGER NOT NULL,

    CONSTRAINT "booking_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_changes" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "booking_id" UUID NOT NULL,
    "from_status" "booking_status",
    "to_status" "booking_status" NOT NULL,
    "changed_by_id" UUID,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "booking_id" UUID NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "amount_cents" INTEGER NOT NULL,
    "provider_link_id" TEXT,
    "checkout_url" TEXT,
    "provider_transaction_id" TEXT,
    "is_live" BOOLEAN,
    "approved_at" TIMESTAMPTZ(3),
    "refunded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "provider" "payment_provider" NOT NULL,
    "external_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payment_id" UUID,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),
    "error" TEXT,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "setting_changes" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "setting_key" TEXT NOT NULL,
    "previous_value" JSONB,
    "new_value" JSONB NOT NULL,
    "changed_by" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "setting_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "addresses_user_id_idx" ON "addresses"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "districts_slug_key" ON "districts"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "districts_name_key" ON "districts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "species_code_key" ON "species"("code");

-- CreateIndex
CREATE UNIQUE INDEX "services_code_key" ON "services"("code");

-- CreateIndex
CREATE INDEX "caregiver_districts_district_id_idx" ON "caregiver_districts"("district_id");

-- CreateIndex
CREATE INDEX "caregiver_service_prices_service_id_care_level_idx" ON "caregiver_service_prices"("service_id", "care_level");

-- CreateIndex
CREATE UNIQUE INDEX "caregiver_availability_caregiver_id_weekday_start_minute_key" ON "caregiver_availability"("caregiver_id", "weekday", "start_minute");

-- CreateIndex
CREATE UNIQUE INDEX "certification_types_code_key" ON "certification_types"("code");

-- CreateIndex
CREATE INDEX "caregiver_certifications_caregiver_id_certification_type_id_idx" ON "caregiver_certifications"("caregiver_id", "certification_type_id");

-- CreateIndex
CREATE INDEX "pets_owner_id_idx" ON "pets"("owner_id");

-- CreateIndex
CREATE INDEX "pet_vaccinations_pet_id_idx" ON "pet_vaccinations"("pet_id");

-- CreateIndex
CREATE INDEX "vet_instructions_pet_id_idx" ON "vet_instructions"("pet_id");

-- CreateIndex
CREATE UNIQUE INDEX "vet_instructions_id_pet_id_key" ON "vet_instructions"("id", "pet_id");

-- CreateIndex
CREATE INDEX "pet_care_needs_pet_id_idx" ON "pet_care_needs"("pet_id");

-- CreateIndex
CREATE UNIQUE INDEX "files_storage_key_key" ON "files"("storage_key");

-- CreateIndex
CREATE INDEX "files_uploaded_by_id_idx" ON "files"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "bookings_caregiver_id_starts_at_idx" ON "bookings"("caregiver_id", "starts_at");

-- CreateIndex
CREATE INDEX "bookings_owner_id_starts_at_idx" ON "bookings"("owner_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_id_caregiver_id_blocks_calendar_key" ON "bookings"("id", "caregiver_id", "blocks_calendar");

-- CreateIndex
CREATE INDEX "booking_pets_pet_id_idx" ON "booking_pets"("pet_id");

-- CreateIndex
CREATE INDEX "booking_vet_instructions_vet_instruction_id_pet_id_idx" ON "booking_vet_instructions"("vet_instruction_id", "pet_id");

-- CreateIndex
CREATE INDEX "booking_slots_booking_id_idx" ON "booking_slots"("booking_id");

-- CreateIndex
CREATE INDEX "booking_status_changes_booking_id_created_at_idx" ON "booking_status_changes"("booking_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_link_id_key" ON "payments"("provider_link_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_transaction_id_key" ON "payments"("provider_transaction_id");

-- CreateIndex
CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_external_id_key" ON "webhook_events"("provider", "external_id");

-- CreateIndex
CREATE INDEX "setting_changes_setting_key_created_at_idx" ON "setting_changes"("setting_key", "created_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregiver_profiles" ADD CONSTRAINT "caregiver_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregiver_profiles" ADD CONSTRAINT "caregiver_profiles_photo_file_id_fkey" FOREIGN KEY ("photo_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregiver_districts" ADD CONSTRAINT "caregiver_districts_caregiver_id_fkey" FOREIGN KEY ("caregiver_id") REFERENCES "caregiver_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregiver_districts" ADD CONSTRAINT "caregiver_districts_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregiver_service_prices" ADD CONSTRAINT "caregiver_service_prices_caregiver_id_fkey" FOREIGN KEY ("caregiver_id") REFERENCES "caregiver_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregiver_service_prices" ADD CONSTRAINT "caregiver_service_prices_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregiver_availability" ADD CONSTRAINT "caregiver_availability_caregiver_id_fkey" FOREIGN KEY ("caregiver_id") REFERENCES "caregiver_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregiver_certifications" ADD CONSTRAINT "caregiver_certifications_caregiver_id_fkey" FOREIGN KEY ("caregiver_id") REFERENCES "caregiver_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregiver_certifications" ADD CONSTRAINT "caregiver_certifications_certification_type_id_fkey" FOREIGN KEY ("certification_type_id") REFERENCES "certification_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_photo_file_id_fkey" FOREIGN KEY ("photo_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_vaccinations" ADD CONSTRAINT "pet_vaccinations_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_vaccinations" ADD CONSTRAINT "pet_vaccinations_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_instructions" ADD CONSTRAINT "vet_instructions_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_instructions" ADD CONSTRAINT "vet_instructions_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_care_needs" ADD CONSTRAINT "pet_care_needs_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_care_needs" ADD CONSTRAINT "pet_care_needs_vet_instruction_id_pet_id_fkey" FOREIGN KEY ("vet_instruction_id", "pet_id") REFERENCES "vet_instructions"("id", "pet_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_caregiver_id_fkey" FOREIGN KEY ("caregiver_id") REFERENCES "caregiver_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_pets" ADD CONSTRAINT "booking_pets_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_pets" ADD CONSTRAINT "booking_pets_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_vet_instructions" ADD CONSTRAINT "booking_vet_instructions_booking_id_pet_id_fkey" FOREIGN KEY ("booking_id", "pet_id") REFERENCES "booking_pets"("booking_id", "pet_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_vet_instructions" ADD CONSTRAINT "booking_vet_instructions_vet_instruction_id_pet_id_fkey" FOREIGN KEY ("vet_instruction_id", "pet_id") REFERENCES "vet_instructions"("id", "pet_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_slots" ADD CONSTRAINT "booking_slots_booking_id_caregiver_id_blocks_calendar_fkey" FOREIGN KEY ("booking_id", "caregiver_id", "blocks_calendar") REFERENCES "bookings"("id", "caregiver_id", "blocks_calendar") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_slots" ADD CONSTRAINT "booking_slots_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_changes" ADD CONSTRAINT "booking_status_changes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_changes" ADD CONSTRAINT "booking_status_changes_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setting_changes" ADD CONSTRAINT "setting_changes_setting_key_fkey" FOREIGN KEY ("setting_key") REFERENCES "settings"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
