import type { UploadPurpose } from '../src/files/files.dto.js';
import type { useApi } from './use-api.js';

type Api = ReturnType<typeof useApi>;

/** The purposes that only take photos; the others are uploaded as a PDF. */
const PHOTO_PURPOSES: UploadPurpose[] = ['PET_PHOTO', 'CAREGIVER_PHOTO', 'SELFIE'];

/** Uploads a small file the way the app does: ask, PUT to the signed URL, complete. */
export async function uploadFile(
  api: Api,
  token: string,
  purpose: UploadPurpose,
  contentType = PHOTO_PURPOSES.includes(purpose) ? 'image/jpeg' : 'application/pdf',
): Promise<string> {
  const bytes = new TextEncoder().encode(`${purpose} de prueba`);
  const { body } = await api
    .http()
    .post('/v1/files')
    .auth(token, { type: 'bearer' })
    .send({ purpose, contentType, sizeBytes: bytes.length })
    .expect(201);
  const put = await fetch(body.uploadUrl, {
    method: 'PUT',
    body: bytes,
    headers: body.uploadHeaders,
  });
  if (!put.ok) {
    throw new Error(`Upload failed with ${put.status}`);
  }
  await api
    .http()
    .post(`/v1/files/${body.file.id}/complete`)
    .auth(token, { type: 'bearer' })
    .expect(200);
  return body.file.id;
}
