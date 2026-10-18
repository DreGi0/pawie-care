import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DistrictOption } from '../catalog/catalog.dto.js';
import { trimmed } from '../common/validation/trimmed.js';

/** Where the owner wants the service. Creating and editing take the whole address. */
export class AddressRequest {
  @ApiProperty({ example: 'Casa', description: 'Cómo la llama el dueño.' })
  @Transform(trimmed)
  @IsString({ message: 'Ponle un nombre, como "Casa".' })
  @IsNotEmpty({ message: 'Ponle un nombre, como "Casa".' })
  @MaxLength(40, { message: 'El nombre puede tener hasta 40 caracteres.' })
  label: string;

  @ApiProperty({
    example: 'Pasaje Las Mascotas 12, Residencial Pawie',
    description: 'Calle, número y colonia o residencial.',
  })
  @Transform(trimmed)
  @IsString({ message: 'Escribe la dirección.' })
  @IsNotEmpty({ message: 'Escribe la dirección.' })
  @MaxLength(200, { message: 'La dirección puede tener hasta 200 caracteres.' })
  street: string;

  @ApiPropertyOptional({
    example: 'Portón verde, a la par de la tienda',
    description: 'Apartamento, código del portón o puntos de referencia.',
  })
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Las indicaciones pueden tener hasta 300 caracteres.' })
  details?: string;

  @ApiProperty({ format: 'uuid', description: 'Uno de los distritos de GET /v1/catalog.' })
  @IsUUID('all', { message: 'Elige un distrito.' })
  districtId: string;
}

export class AddressResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Casa' })
  label: string;

  @ApiProperty({ example: 'Pasaje Las Mascotas 12, Residencial Pawie' })
  street: string;

  @ApiProperty({ type: String, nullable: true })
  details: string | null;

  @ApiProperty({ type: DistrictOption })
  district: DistrictOption;
}
