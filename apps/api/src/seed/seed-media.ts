import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { StorageService } from '../files/storage.service.js';
import type { FilePurpose, PrismaClient } from '../generated/prisma/client.js';

/** Where the seed looks for photos, and the bucket it uploads them to. See seed-media/README.md. */
export interface SeedMedia {
  storage: StorageService;
  directory: string;
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * Uploads `<directory>/<folder>/<name>.<jpg|jpeg|png|webp>` and records it as a file,
 * under a key that depends only on the name, so running the seed again replaces it.
 * Returns the file's id, or null when nobody put an image there.
 */
export async function seedPhoto(
  prisma: PrismaClient,
  { storage, directory }: SeedMedia,
  photo: {
    folder: 'caregivers' | 'pets';
    name: string;
    purpose: FilePurpose;
    uploadedById: string;
  },
): Promise<string | null> {
  const entries = await readdir(join(directory, photo.folder)).catch(() => [] as string[]);
  const image = entries.find(
    (entry) =>
      entry.slice(0, -extname(entry).length).toLowerCase() === photo.name &&
      CONTENT_TYPES[extname(entry).toLowerCase()] !== undefined,
  );
  if (!image) {
    return null;
  }

  const contentType = CONTENT_TYPES[extname(image).toLowerCase()];
  const body = await readFile(join(directory, photo.folder, image));
  const storageKey = `seed/${photo.folder}/${photo.name}${extname(image).toLowerCase()}`;
  await storage.put(storageKey, body, contentType);

  const uploaded = { contentType, sizeBytes: body.length, uploadedAt: new Date() };
  const file = await prisma.file.upsert({
    where: { storageKey },
    create: { storageKey, purpose: photo.purpose, uploadedById: photo.uploadedById, ...uploaded },
    update: uploaded,
  });
  return file.id;
}

/** "María José" to "maria-jose", for matching file names. */
export function mediaName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-');
}
