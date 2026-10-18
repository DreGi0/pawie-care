import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/environment.js';

export interface StoredObject {
  sizeBytes: number;
  contentType: string | undefined;
}

/**
 * The private bucket (docs/arquitectura.md §4.11): SeaweedFS locally and Cloudflare R2
 * deployed. Nothing in it is public; the apps upload and download with signed URLs
 * that expire quickly.
 */
@Injectable()
export class StorageService implements OnModuleDestroy {
  private readonly client: S3Client;
  /** Same credentials, but it signs URLs for the host the apps reach (S3_PUBLIC_ENDPOINT). */
  private readonly signer: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService<Environment, true>) {
    const endpoint = config.get('S3_ENDPOINT', { infer: true });
    const options: S3ClientConfig = {
      region: config.get('S3_REGION', { infer: true }),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY_ID', { infer: true }),
        secretAccessKey: config.get('S3_SECRET_ACCESS_KEY', { infer: true }),
      },
      // SeaweedFS needs path-style URLs, and R2 accepts them.
      forcePathStyle: true,
      // The SDK adds CRC32 checksums by default, which break signed uploads: the URL
      // would carry the checksum of an empty body. R2 recommends turning them off too.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    };
    this.client = new S3Client({ ...options, endpoint });
    this.signer = new S3Client({
      ...options,
      endpoint: config.get('S3_PUBLIC_ENDPOINT', { infer: true }) ?? endpoint,
    });
    this.bucket = config.get('S3_BUCKET', { infer: true });
  }

  /**
   * A URL to PUT exactly this type and size. Both are signed, so the bucket rejects
   * any other file: that's how the size limit holds without the API seeing the bytes.
   */
  uploadUrl(
    key: string,
    { contentType, sizeBytes }: { contentType: string; sizeBytes: number },
    expiresInSeconds: number,
  ): Promise<string> {
    return getSignedUrl(
      this.signer,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: sizeBytes,
      }),
      { expiresIn: expiresInSeconds, signableHeaders: new Set(['content-type', 'content-length']) },
    );
  }

  downloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(this.signer, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  /** What's stored under the key, or null if nothing was uploaded yet. */
  async head(key: string): Promise<StoredObject | null> {
    try {
      const object = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return { sizeBytes: object.ContentLength ?? 0, contentType: object.ContentType };
    } catch (error) {
      if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /** Uploads from the API itself, as the seed does. */
  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  onModuleDestroy(): void {
    this.client.destroy();
    this.signer.destroy();
  }
}
