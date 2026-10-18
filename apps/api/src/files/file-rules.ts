import { FilePurpose } from '../generated/prisma/enums.js';

const MB = 1024 * 1024;

/** iPhones take photos in HEIC unless the app converts them. */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
/** A prescription can be a PDF or a photo of the paper. */
const DOCUMENT_TYPES = [...IMAGE_TYPES, 'application/pdf'];

export interface FileRule {
  contentTypes: readonly string[];
  maxBytes: number;
  /** First part of the object key, to keep the bucket browsable. */
  folder: string;
}

export const FILE_RULES: Readonly<Record<FilePurpose, FileRule>> = {
  [FilePurpose.PET_PHOTO]: { contentTypes: IMAGE_TYPES, maxBytes: 10 * MB, folder: 'pet-photos' },
  [FilePurpose.CAREGIVER_PHOTO]: {
    contentTypes: IMAGE_TYPES,
    maxBytes: 10 * MB,
    folder: 'caregiver-photos',
  },
  [FilePurpose.VET_INSTRUCTION]: {
    contentTypes: DOCUMENT_TYPES,
    maxBytes: 15 * MB,
    folder: 'vet-instructions',
  },
  [FilePurpose.VACCINATION_RECORD]: {
    contentTypes: DOCUMENT_TYPES,
    maxBytes: 15 * MB,
    folder: 'vaccination-records',
  },
};

/** What an owner can upload. Caregiver photos come from the seed until caregivers sign up. */
export const OWNER_UPLOAD_PURPOSES = [
  FilePurpose.PET_PHOTO,
  FilePurpose.VET_INSTRUCTION,
  FilePurpose.VACCINATION_RECORD,
] as const;

/** Signed URLs expire this quickly (docs/arquitectura.md §4.11). */
export const SIGNED_URL_TTL_SECONDS = 10 * 60;
