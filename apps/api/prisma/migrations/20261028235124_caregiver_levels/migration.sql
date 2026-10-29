-- CreateEnum
CREATE TYPE "caregiver_level" AS ENUM ('NEW', 'TRUSTED', 'PRO', 'SUPER');

-- CreateEnum
CREATE TYPE "caregiver_skill" AS ENUM ('LARGE_DOGS', 'CATS', 'PUPPIES', 'SENIOR_PETS', 'DIFFICULT_BEHAVIOR');

-- AlterTable
ALTER TABLE "caregiver_profiles" ADD COLUMN     "level" "caregiver_level" NOT NULL DEFAULT 'NEW',
ADD COLUMN     "skills" "caregiver_skill"[] DEFAULT ARRAY[]::"caregiver_skill"[];

-- Written by hand. RN-CUI-08, RN-CUI-09: the exam score and the validity now apply to every
-- certification, not just the ⭐. Renaming the rows keeps the value someone set with
-- settings:set; setting_changes follows through ON UPDATE CASCADE.
UPDATE "settings" SET "key" = 'certifications.minExamScoreBp'
  WHERE "key" = 'certifications.specialCareMinExamScoreBp';
UPDATE "settings" SET "key" = 'certifications.validityMonths'
  WHERE "key" = 'certifications.specialCareValidityMonths';
