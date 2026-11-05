import { filesComplete, filesCreateUpload, type UploadPurpose } from '@pawie/api-client';

/**
 * Web version of files.ts. The pickers return a blob: or data: URI, and expo-file-system's
 * `File` doesn't exist in the browser, so the file is read with `fetch(uri).blob()`. The
 * limits stay signed in the upload URL (docs/arquitectura.md §4.11).
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
  const uploaded = await filesComplete(upload.file.id);
  return uploaded.id;
}
