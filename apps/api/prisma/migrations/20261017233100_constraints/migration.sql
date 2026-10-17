-- Written by hand: what schema.prisma can't express. Prisma Migrate leaves these
-- objects alone (since 7.5 it keeps manual partial indexes while the partialIndexes
-- preview feature is off), and test/database/migrations.e2e-spec.ts checks that the
-- migrations still match the schema. Rule IDs refer to docs/reglas-de-negocio.md.

-- ─── Booking slots ──────────────────────────────────────────────────────────────

-- RN-CUI-15: a caregiver can't have slots that overlap. Each slot blocks only its own
-- time, and only while its booking holds the calendar (bookings_blocks_calendar_check).
-- '[)' lets one slot start exactly when another ends.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "booking_slots"
  ADD CONSTRAINT "booking_slots_no_overlap"
  EXCLUDE USING gist ("caregiver_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("blocks_calendar");

ALTER TABLE "booking_slots"
  ADD CONSTRAINT "booking_slots_dates_check" CHECK ("starts_at" < "ends_at"),
  ADD CONSTRAINT "booking_slots_prices_check"
    CHECK ("unit_price_cents" > 0 AND "subtotal_cents" >= "unit_price_cents");

-- ─── Bookings ───────────────────────────────────────────────────────────────────

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_dates_check" CHECK ("starts_at" < "ends_at"),
  -- Every status holds the caregiver's time except these, REQUESTED included (first
  -- come, first served). The foreign key of booking_slots cascades the value.
  ADD CONSTRAINT "bookings_blocks_calendar_check" CHECK (
    "blocks_calendar" = ("status" NOT IN ('REJECTED', 'EXPIRED', 'CANCELLED_BY_OWNER', 'CANCELLED_BY_CAREGIVER'))
  ),
  -- RN-RES-06, RN-RES-07
  ADD CONSTRAINT "bookings_response_due_at_check"
    CHECK ("status" <> 'REQUESTED' OR "response_due_at" IS NOT NULL),
  ADD CONSTRAINT "bookings_payment_due_at_check"
    CHECK ("status" <> 'PENDING_PAYMENT' OR "payment_due_at" IS NOT NULL),
  -- RN-PRE-07: the copied rates are percentages in basis points.
  ADD CONSTRAINT "bookings_rates_check" CHECK (
    "owner_service_fee_bp" BETWEEN 0 AND 10000
    AND "caregiver_commission_bp" BETWEEN 0 AND 10000
    AND "additional_pet_surcharge_bp" BETWEEN 0 AND 10000
    AND "guarantee_fund_bp" BETWEEN 0 AND 10000
    AND "vat_bp" BETWEEN 0 AND 10000
    AND "gateway_fee_bp" BETWEEN 0 AND 10000
  ),
  -- RN-PRE-03, RN-PRE-04: the owner pays the subtotal plus the service fee, and the
  -- caregiver gets the subtotal minus the commission.
  ADD CONSTRAINT "bookings_amounts_check" CHECK (
    "subtotal_cents" > 0
    AND "owner_service_fee_cents" >= 0
    AND "caregiver_commission_cents" BETWEEN 0 AND "subtotal_cents"
    AND "total_cents" = "subtotal_cents" + "owner_service_fee_cents"
    AND "caregiver_payout_cents" = "subtotal_cents" - "caregiver_commission_cents"
    AND "emergency_preauthorized_cents" >= 0
  );

-- ─── Payments ───────────────────────────────────────────────────────────────────

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_check" CHECK ("amount_cents" > 0),
  ADD CONSTRAINT "payments_approved_at_check"
    CHECK (("status" IN ('APPROVED', 'REFUND_PENDING', 'REFUNDED')) = ("approved_at" IS NOT NULL)),
  ADD CONSTRAINT "payments_refunded_at_check"
    CHECK (("status" = 'REFUNDED') = ("refunded_at" IS NOT NULL));

-- RN-PAG-02: one booking is paid once. A late or duplicate approval goes to
-- REFUND_PENDING instead.
CREATE UNIQUE INDEX "payments_one_approved_per_booking_key"
  ON "payments" ("booking_id")
  WHERE "status" = 'APPROVED';

-- ─── Pets ───────────────────────────────────────────────────────────────────────

ALTER TABLE "pets"
  ADD CONSTRAINT "pets_weight_check" CHECK ("weight_grams" > 0);

ALTER TABLE "pet_vaccinations"
  ADD CONSTRAINT "pet_vaccinations_dates_check" CHECK ("next_due_on" > "administered_on");

-- RN-MAS-06, RN-MAS-08, RN-CUI-12, RN-CUI-13. Keep the task lists in sync with
-- src/pets/care-tasks.ts.
ALTER TABLE "pet_care_needs"
  ADD CONSTRAINT "pet_care_needs_dates_check" CHECK ("ends_on" >= "starts_on"),
  -- Clinical tasks need written vet instructions.
  ADD CONSTRAINT "pet_care_needs_vet_instruction_check" CHECK (
    "task" NOT IN ('MEDICATION', 'WOUND_CARE', 'POST_OPERATIVE_RECOVERY', 'SYRINGE_FEEDING', 'PRESCRIBED_REST', 'CHRONIC_CONDITION_MONITORING')
    OR "vet_instruction_id" IS NOT NULL
  ),
  -- Assistance tasks need the owner's written instructions.
  ADD CONSTRAINT "pet_care_needs_owner_instructions_check" CHECK (
    "task" NOT IN ('MOBILITY_ASSISTANCE', 'INCONTINENCE_HYGIENE')
    OR btrim(coalesce("owner_instructions", '')) <> ''
  ),
  -- Only chronic monitoring, mobility help and the prohibited tasks can be open-ended.
  ADD CONSTRAINT "pet_care_needs_ends_on_check" CHECK (
    "ends_on" IS NOT NULL
    OR "task" IN (
      'CHRONIC_CONDITION_MONITORING', 'MOBILITY_ASSISTANCE',
      'INJECTION', 'IV_FLUIDS', 'STITCH_OR_DRAIN_REMOVAL', 'TUBE_PLACEMENT', 'SEDATION', 'DOSE_CHANGE', 'DIAGNOSIS_OR_PRESCRIPTION'
    )
  );

-- ─── Caregivers ─────────────────────────────────────────────────────────────────

-- Ratings go from 1 to 5, so the sum stays between the count and five times the
-- count. Special-care ratings are a subset of all ratings.
ALTER TABLE "caregiver_profiles"
  ADD CONSTRAINT "caregiver_profiles_ratings_check" CHECK (
    "rating_sum" BETWEEN "rating_count" AND 5 * "rating_count"
    AND "special_rating_sum" BETWEEN "special_rating_count" AND 5 * "special_rating_count"
    AND "special_rating_count" <= "rating_count"
  ),
  ADD CONSTRAINT "caregiver_profiles_completed_bookings_check" CHECK ("completed_booking_count" >= 0);

-- A null price means the suggested one.
ALTER TABLE "caregiver_service_prices"
  ADD CONSTRAINT "caregiver_service_prices_price_check" CHECK ("price_cents" > 0);

-- Windows can cross midnight (end_minute past 1440) but last at most a day.
ALTER TABLE "caregiver_availability"
  ADD CONSTRAINT "caregiver_availability_weekday_check" CHECK ("weekday" BETWEEN 1 AND 7),
  ADD CONSTRAINT "caregiver_availability_window_check" CHECK (
    "start_minute" BETWEEN 0 AND 1439
    AND "end_minute" > "start_minute"
    AND "end_minute" <= "start_minute" + 1440
  );

ALTER TABLE "caregiver_certifications"
  ADD CONSTRAINT "caregiver_certifications_dates_check" CHECK ("valid_until" >= "obtained_on"),
  ADD CONSTRAINT "caregiver_certifications_revoked_at_check"
    CHECK (("status" = 'REVOKED') = ("revoked_at" IS NOT NULL));

-- RN-CUI-11: at most one active certification per caregiver and type.
CREATE UNIQUE INDEX "caregiver_certifications_one_active_key"
  ON "caregiver_certifications" ("caregiver_id", "certification_type_id")
  WHERE "status" = 'ACTIVE';

-- ─── Accounts ───────────────────────────────────────────────────────────────────

ALTER TABLE "users"
  -- Normalized, so the unique index on email ignores case and surrounding spaces.
  ADD CONSTRAINT "users_email_check" CHECK ("email" = lower(btrim("email")) AND "email" <> ''),
  -- RN-CTA-01. Prisma creates list columns as nullable, so this also rules out NULL.
  ADD CONSTRAINT "users_roles_check" CHECK ("roles" IS NOT NULL AND cardinality("roles") > 0);
