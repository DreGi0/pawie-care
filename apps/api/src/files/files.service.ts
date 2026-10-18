import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { File, FilePurpose } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FILE_RULES, SIGNED_URL_TTL_SECONDS } from './file-rules.js';
import type { CreateUploadRequest, FileResponse, FileUpload } from './files.dto.js';
import { StorageService } from './storage.service.js';

/**
 * Files go straight from the app to the bucket: the API signs an upload URL, the app
 * PUTs the file, and then marks it complete. Other modules only accept files that
 * are complete, belong to the user and have the right purpose (requireUploaded).
 */
@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async createUpload(
    userId: string,
    { purpose, contentType, sizeBytes }: CreateUploadRequest,
  ): Promise<FileUpload> {
    const rule = FILE_RULES[purpose];
    if (!rule.contentTypes.includes(contentType)) {
      throw new UnprocessableEntityException({
        errorCode: 'UNSUPPORTED_FILE_TYPE',
        message: 'Ese formato no se puede subir. Usa una foto (JPEG, PNG, WebP o HEIC) o un PDF.',
        details: { allowed: rule.contentTypes },
      });
    }
    if (sizeBytes > rule.maxBytes) {
      throw new UnprocessableEntityException({
        errorCode: 'FILE_TOO_LARGE',
        message: `El archivo pesa demasiado. El máximo es ${rule.maxBytes / (1024 * 1024)} MB.`,
        details: { maxBytes: rule.maxBytes },
      });
    }

    const file = await this.prisma.file.create({
      data: {
        uploadedById: userId,
        purpose,
        contentType,
        storageKey: `${rule.folder}/${userId}/${randomUUID()}`,
      },
    });
    return {
      file: await this.toResponse(file),
      uploadUrl: await this.storage.uploadUrl(
        file.storageKey,
        { contentType, sizeBytes },
        SIGNED_URL_TTL_SECONDS,
      ),
      uploadMethod: 'PUT',
      uploadHeaders: { 'Content-Type': contentType },
      uploadExpiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
    };
  }

  /** Checks that the bucket has the file and marks it uploaded. Calling it again is fine. */
  async complete(userId: string, fileId: string): Promise<FileResponse> {
    const file = await this.findOwn(userId, fileId);
    if (file.uploadedAt) {
      return this.toResponse(file);
    }
    const stored = await this.storage.head(file.storageKey);
    if (!stored) {
      throw notUploaded();
    }
    const uploaded = await this.prisma.file.update({
      where: { id: file.id },
      data: { uploadedAt: new Date(), sizeBytes: stored.sizeBytes },
    });
    return this.toResponse(uploaded);
  }

  async get(userId: string, fileId: string): Promise<FileResponse> {
    return this.toResponse(await this.findOwn(userId, fileId));
  }

  /** A complete file of this user, for attaching it to something. */
  async requireUploaded(userId: string, fileId: string, purpose: FilePurpose): Promise<File> {
    const file = await this.findOwn(userId, fileId);
    if (!file.uploadedAt) {
      throw notUploaded();
    }
    if (file.purpose !== purpose) {
      throw new UnprocessableEntityException({
        errorCode: 'WRONG_FILE_PURPOSE',
        message: 'Ese archivo se subió para otra cosa. Súbelo de nuevo desde aquí.',
      });
    }
    return file;
  }

  /** A signed URL to download the file, or null while it isn't uploaded. */
  async downloadUrl(file: Pick<File, 'storageKey' | 'uploadedAt'> | null): Promise<string | null> {
    return file?.uploadedAt
      ? this.storage.downloadUrl(file.storageKey, SIGNED_URL_TTL_SECONDS)
      : null;
  }

  async toResponse(file: File): Promise<FileResponse> {
    return {
      id: file.id,
      purpose: file.purpose,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
      uploadedAt: file.uploadedAt?.toISOString() ?? null,
      url: await this.downloadUrl(file),
    };
  }

  private async findOwn(userId: string, fileId: string): Promise<File> {
    const file = await this.prisma.file.findFirst({ where: { id: fileId, uploadedById: userId } });
    if (!file) {
      throw new NotFoundException({
        errorCode: 'FILE_NOT_FOUND',
        message: 'No encontramos ese archivo.',
      });
    }
    return file;
  }
}

function notUploaded(): ConflictException {
  return new ConflictException({
    errorCode: 'FILE_NOT_UPLOADED',
    message: 'Todavía no recibimos el archivo. Súbelo y vuelve a intentarlo.',
  });
}
