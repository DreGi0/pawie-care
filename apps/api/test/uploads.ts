import type { useApi } from './use-api.js';

type Api = ReturnType<typeof useApi>;

/** Uploads a small file the way the app does: ask, PUT to the signed URL, complete. */
export async function uploadFile(
  api: Api,
  token: string,
  purpose: 'PET_PHOTO' | 'VET_INSTRUCTION' | 'VACCINATION_RECORD',
  contentType = purpose === 'PET_PHOTO' ? 'image/jpeg' : 'application/pdf',
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
