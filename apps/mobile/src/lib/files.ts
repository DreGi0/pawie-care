import { filesComplete, filesCreateUpload, type UploadPurpose } from '@pawie/api-client';

/**
 * Uploads a file of the phone (from expo-image-picker, for example) in the API's three steps:
 * ask for an upload, PUT it straight to the storage and confirm it. Returns the file's id.
 */
export async function uploadFile(
  uri: string,
  contentType: string,
  purpose: UploadPurpose,
): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  const upload = await filesCreateUpload({ purpose, contentType, sizeBytes: blob.size });
  const response = await fetch(upload.uploadUrl, {
    method: upload.uploadMethod,
    headers: upload.uploadHeaders,
    body: blob,
  });
  if (!response.ok) throw new Error(`The storage answered ${response.status} to the upload`);
  const file = await filesComplete(upload.file.id);
  return file.id;
}
