-- Stage 9a: caregiver sign-up (docs/plan-v0.6.md). Written by hand over what Prisma
-- generated, to keep each caregiver's state and to add the CHECK constraints.

-- CreateEnum
CREATE TYPE "app_mode" AS ENUM ('OWNER', 'CAREGIVER');

-- CreateEnum
CREATE TYPE "caregiver_document_kind" AS ENUM ('ID_DOCUMENT_FRONT', 'ID_DOCUMENT_BACK', 'SELFIE', 'BACKGROUND_CHECK');

-- AlterEnum. PostgreSQL 12+ accepts several values in one transaction, as long as this
-- migration doesn't use them.
ALTER TYPE "file_purpose" ADD VALUE 'ID_DOCUMENT';
ALTER TYPE "file_purpose" ADD VALUE 'SELFIE';
ALTER TYPE "file_purpose" ADD VALUE 'BACKGROUND_CHECK';

-- RN-CUI-20: is_active becomes is_paused. "Active" read like "approved"; the rule talks
-- about pausing. Renaming and negating it keeps every caregiver as it was.
ALTER TABLE "caregiver_profiles" RENAME COLUMN "is_active" TO "is_paused";
ALTER TABLE "caregiver_profiles" ALTER COLUMN "is_paused" DROP DEFAULT;
UPDATE "caregiver_profiles" SET "is_paused" = NOT "is_paused";
ALTER TABLE "caregiver_profiles" ALTER COLUMN "is_paused" SET DEFAULT false;

-- RN-CUI-02, RN-CUI-03: searches now need the welcome course. The caregivers approved
-- before the course existed keep showing up; the seed sets it for the demo caregivers.
ALTER TABLE "caregiver_profiles" ADD COLUMN "welcome_course_passed_at" TIMESTAMPTZ(3);
UPDATE "caregiver_profiles" SET "welcome_course_passed_at" = CURRENT_TIMESTAMP
  WHERE "status" = 'APPROVED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "last_mode" "app_mode" NOT NULL DEFAULT 'OWNER';

-- CreateTable
CREATE TABLE "caregiver_documents" (
    "caregiver_id" UUID NOT NULL,
    "kind" "caregiver_document_kind" NOT NULL,
    "file_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "caregiver_documents_pkey" PRIMARY KEY ("caregiver_id","kind")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_modules" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "course_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "course_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_questions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "module_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" TEXT[],
    "correct_option" SMALLINT NOT NULL,

    CONSTRAINT "course_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_attempts" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "course_id" UUID NOT NULL,
    "caregiver_id" UUID NOT NULL,
    "score_bp" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "caregiver_documents_file_id_idx" ON "caregiver_documents"("file_id");

-- CreateIndex
CREATE UNIQUE INDEX "courses_code_key" ON "courses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "course_modules_course_id_position_key" ON "course_modules"("course_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "course_questions_module_id_position_key" ON "course_questions"("module_id", "position");

-- CreateIndex
CREATE INDEX "course_attempts_caregiver_id_course_id_idx" ON "course_attempts"("caregiver_id", "course_id");

-- AddForeignKey
ALTER TABLE "caregiver_documents" ADD CONSTRAINT "caregiver_documents_caregiver_id_fkey" FOREIGN KEY ("caregiver_id") REFERENCES "caregiver_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregiver_documents" ADD CONSTRAINT "caregiver_documents_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_questions" ADD CONSTRAINT "course_questions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "course_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_attempts" ADD CONSTRAINT "course_attempts_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_attempts" ADD CONSTRAINT "course_attempts_caregiver_id_fkey" FOREIGN KEY ("caregiver_id") REFERENCES "caregiver_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Written by hand: the CHECK constraints the schema mentions (docs/arquitectura.md §4.8).
ALTER TABLE "course_modules"
  ADD CONSTRAINT "course_modules_position_check" CHECK ("position" > 0);

ALTER TABLE "course_questions"
  ADD CONSTRAINT "course_questions_position_check" CHECK ("position" > 0),
  ADD CONSTRAINT "course_questions_options_check" CHECK (
    cardinality("options") >= 2
    AND "correct_option" >= 0
    AND "correct_option" < cardinality("options")
  );

ALTER TABLE "course_attempts"
  ADD CONSTRAINT "course_attempts_score_check" CHECK ("score_bp" BETWEEN 0 AND 10000);
