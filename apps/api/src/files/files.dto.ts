import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsString, MaxLength, Min } from 'class-validator';
import { FilePurpose } from '../generated/prisma/enums.js';
import { UPLOAD_PURPOSES } from './file-rules.js';

export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export class CreateUploadRequest {
  @ApiProperty({ enum: UPLOAD_PURPOSES, enumName: 'UploadPurpose' })
  @IsIn(UPLOAD_PURPOSES, { message: 'Ese tipo de archivo no se puede subir.' })
  purpose: UploadPurpose;

  @ApiProperty({
    example: 'image/jpeg',
    description:
      'Fotos y selfie: JPEG, PNG, WebP o HEIC, hasta 10 MB. Recetas, carnés de vacunas, DUI y antecedentes: también PDF, hasta 15 MB.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MaxLength(100)
  contentType: string;

  @ApiProperty({
    type: 'integer',
    example: 245_000,
    description: 'Tamaño exacto del archivo en bytes. La subida tiene que coincidir.',
  })
  @IsInt({ message: 'El tamaño tiene que ser un número entero de bytes.' })
  @Min(1, { message: 'El archivo está vacío.' })
  sizeBytes: number;
}

export class FileResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: FilePurpose, enumName: 'FilePurpose' })
  purpose: FilePurpose;

  @ApiProperty({ example: 'image/jpeg' })
  contentType: string;

  @ApiProperty({ type: 'integer', nullable: true, description: 'Null hasta que se sube.' })
  sizeBytes: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  uploadedAt: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'URL firmada para descargarlo, que vence en 10 minutos. Null hasta que se sube.',
  })
  url: string | null;
}

/** Where and how to upload the file. */
export class FileUpload {
  @ApiProperty({ type: FileResponse })
  file: FileResponse;

  @ApiProperty({
    description: 'Hay que subir el archivo con PUT a esta URL, que vence en 10 minutos.',
  })
  uploadUrl: string;

  @ApiProperty({ enum: ['PUT'] })
  uploadMethod: 'PUT';

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { 'Content-Type': 'image/jpeg' },
    description: 'Headers que tiene que llevar el PUT, tal cual.',
  })
  uploadHeaders: Record<string, string>;

  @ApiProperty({ format: 'date-time' })
  uploadExpiresAt: string;
}
