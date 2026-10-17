import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { ErrorResponse } from './error-response.dto.js';

const DEFAULT_MESSAGES: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'La solicitud no es válida.',
  [HttpStatus.UNAUTHORIZED]: 'Necesitas iniciar sesión.',
  [HttpStatus.FORBIDDEN]: 'No tienes permiso para hacer esto.',
  [HttpStatus.NOT_FOUND]: 'No encontramos lo que buscas.',
  [HttpStatus.CONFLICT]: 'La solicitud choca con el estado actual de los datos.',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'La solicitud es demasiado grande.',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Hiciste demasiadas solicitudes. Intenta de nuevo en un momento.',
  [HttpStatus.SERVICE_UNAVAILABLE]:
    'El servicio no está disponible en este momento. Intenta de nuevo más tarde.',
};
const CLIENT_ERROR_MESSAGE = 'No pudimos procesar la solicitud.';
const SERVER_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intenta de nuevo más tarde.';

/**
 * Turns every error into the API's single error shape (ErrorResponse).
 *
 * An HttpException thrown with an `errorCode` keeps its message and details, so that
 * message must be written in Spanish: clients show it to the user. Every other error
 * (framework errors, unexpected failures) gets a generic Spanish message and an
 * errorCode derived from the HTTP status, so internal details never reach the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = toErrorResponse(exception);
    if (body.statusCode >= 500) {
      this.logger.error(exception);
    }
    this.adapterHost.httpAdapter.reply(host.switchToHttp().getResponse(), body, body.statusCode);
  }
}

export function toErrorResponse(exception: unknown): ErrorResponse {
  const statusCode = statusOf(exception);

  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    const body = isRecord(response) ? response : {};
    const errorCode = exception.errorCode ?? (typeof body.errorCode === 'string' && body.errorCode);
    if (errorCode) {
      return {
        statusCode,
        errorCode,
        message: typeof body.message === 'string' ? body.message : exception.message,
        ...(isRecord(body.details) && { details: body.details }),
      };
    }
  }

  return {
    statusCode,
    errorCode: (HttpStatus[statusCode] as string | undefined) ?? 'INTERNAL_SERVER_ERROR',
    message:
      DEFAULT_MESSAGES[statusCode] ??
      (statusCode < 500 ? CLIENT_ERROR_MESSAGE : SERVER_ERROR_MESSAGE),
  };
}

function statusOf(exception: unknown): number {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }
  // Errors raised by Express middleware, such as body-parser, carry their own status.
  if (isRecord(exception) && typeof exception.status === 'number') {
    const { status } = exception;
    if (status >= 400 && status < 600) {
      return status;
    }
  }
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
