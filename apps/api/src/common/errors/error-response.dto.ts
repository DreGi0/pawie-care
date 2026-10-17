import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Body of every error response. Built by AllExceptionsFilter. */
export class ErrorResponse {
  @ApiProperty({ description: 'Código de estado HTTP.', type: 'integer', example: 404 })
  statusCode: number;

  @ApiProperty({
    description:
      'Código estable del error, en inglés. El cliente decide qué hacer según este valor, no según el mensaje.',
    example: 'NOT_FOUND',
  })
  errorCode: string;

  @ApiProperty({
    description: 'Mensaje en español para mostrarle al usuario.',
    example: 'No encontramos lo que buscas.',
  })
  message: string;

  @ApiPropertyOptional({
    description:
      'Información adicional. En los errores de validación trae los mensajes de cada campo.',
    type: 'object',
    additionalProperties: true,
    example: { email: ['email must be an email'] },
  })
  details?: Record<string, unknown>;
}
