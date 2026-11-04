import { filesComplete, filesCreateUpload, type UploadPurpose } from '@pawie/api-client';
import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';

/**
 * Uploads a file of the phone (from expo-image-picker or expo-document-picker) in the API's three
 * steps: ask for an upload, PUT it straight to the storage and confirm it. Returns the file's id.
 *
 * The file goes as expo-file-system's File through expo/fetch: on SDK 58, React Native's
 * `fetch(uri).blob()` reads a local file as a few empty bytes, so the size signed in the URL
 * didn't match and the storage answered 403.
 */
export async function uploadFile(
  uri: string,
  contentType: string,
  purpose: UploadPurpose,
): Promise<string> {
  const file = new File(uri);
  const upload = await filesCreateUpload({ purpose, contentType, sizeBytes: file.size });
  const response = await fetch(upload.uploadUrl, {
    method: upload.uploadMethod,
    headers: upload.uploadHeaders,
    body: file,
  });
  if (!response.ok) throw new Error(`The storage answered ${response.status} to the upload`);
  const uploaded = await filesComplete(upload.file.id);
  return uploaded.id;
}
