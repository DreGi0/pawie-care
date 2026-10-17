import { BadRequestException, ValidationPipe, type ValidationError } from '@nestjs/common';

/**
 * Global ValidationPipe: strips nothing silently (unknown properties are rejected),
 * converts payloads into their DTO classes, and reports failures in the API error
 * shape, with the messages of each field in `details`.
 */
export class ApiValidationPipe extends ValidationPipe {
  constructor() {
    super({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  }

  override createExceptionFactory() {
    return (errors: ValidationError[] = []) =>
      new BadRequestException({
        errorCode: 'VALIDATION_FAILED',
        message: 'Revisa los datos enviados.',
        details: this.groupValidationErrors(errors),
      });
  }
}
