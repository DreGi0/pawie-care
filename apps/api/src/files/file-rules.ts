import { FilePurpose } from '../generated/prisma/enums.js';

const MB = 1024 * 1024;

/** iPhones take photos in HEIC unless the app converts them. */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
/** A prescription or a criminal record certificate can be a PDF or a photo of the paper. */
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
  // RN-CUI-01: the caregiver's documents. Only the caregiver and the admins see them.
  [FilePurpose.ID_DOCUMENT]: {
    contentTypes: DOCUMENT_TYPES,
    maxBytes: 15 * MB,
    folder: 'caregiver-documents',
  },
  [FilePurpose.SELFIE]: {
    contentTypes: IMAGE_TYPES,
    maxBytes: 10 * MB,
    folder: 'caregiver-documents',
  },
  [FilePurpose.BACKGROUND_CHECK]: {
    contentTypes: DOCUMENT_TYPES,
    maxBytes: 15 * MB,
    folder: 'caregiver-documents',
  },
};

/**
 * What the app can upload. Any account can upload them, but only a caregiver profile
 * takes the caregiver's photo and documents (RN-CTA-06).
 */
export const UPLOAD_PURPOSES = [
  FilePurpose.PET_PHOTO,
  FilePurpose.VET_INSTRUCTION,
  FilePurpose.VACCINATION_RECORD,
  FilePurpose.CAREGIVER_PHOTO,
  FilePurpose.ID_DOCUMENT,
  FilePurpose.SELFIE,
  FilePurpose.BACKGROUND_CHECK,
] as const;

/** Signed URLs expire this quickly (docs/arquitectura.md §4.11). */
export const SIGNED_URL_TTL_SECONDS = 10 * 60;
