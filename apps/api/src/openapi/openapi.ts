import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_UI_PATH = 'docs';

/**
 * Builds the OpenAPI document, the contract with the clients. It must not depend on
 * the environment: apps/api/openapi.json is generated from it and checked in CI.
 */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Pawie Care API')
    .setDescription(
      'API REST de Pawie Care. Las reglas de negocio están en docs/reglas-de-negocio.md y el diseño en docs/arquitectura.md. ' +
        'Los errores siempre tienen la forma de `ErrorResponse`.',
    )
    .setVersion('1')
    // Protected routes say so with @ApiBearerAuth(). The mobile app sends the access token
    // in the Authorization header.
    .addBearerAuth()
    .build();

  return SwaggerModule.createDocument(app, config, {
    // "HealthController.check" becomes "Health_check", which Orval turns into healthCheck().
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });
}

/** Serves Swagger UI at /docs and the raw document at /docs/openapi.json. */
export function setupSwaggerUi(app: INestApplication): void {
  SwaggerModule.setup(SWAGGER_UI_PATH, app, () => createOpenApiDocument(app), {
    jsonDocumentUrl: `${SWAGGER_UI_PATH}/openapi.json`,
    customSiteTitle: 'Pawie Care API',
  });
}
