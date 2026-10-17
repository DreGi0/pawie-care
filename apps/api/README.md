# @pawie/api

API REST de Pawie Care, hecha con NestJS 12. Las reglas de negocio que implementa están en [docs/reglas-de-negocio.md](../../docs/reglas-de-negocio.md) y su diseño en [docs/arquitectura.md](../../docs/arquitectura.md).

## Desarrollo

```bash
pnpm infra:up              # desde la raíz: PostgreSQL, Redis y Mailpit
cp .env.example .env
pnpm dev                   # genera el cliente de Prisma y levanta http://localhost:3000
```

- **Estado:** <http://localhost:3000/v1/health> revisa la conexión con la base de datos y responde 200, o 503 si algo falla.
- **Documentación:** Swagger UI en <http://localhost:3000/docs>, y el documento OpenAPI en <http://localhost:3000/docs/openapi.json>.

## Configuración

Las variables de entorno se validan al arrancar, en [src/config/environment.ts](src/config/environment.ts). Si falta una o tiene un valor inválido, la API no arranca y dice cuál es. Están todas en [.env.example](.env.example).

| Variable       | Para qué                                                                          | Por defecto   |
| -------------- | --------------------------------------------------------------------------------- | ------------- |
| `NODE_ENV`     | `development`, `test` o `production`. En `development` los logs son legibles      | `development` |
| `PORT`         | Puerto HTTP                                                                       | `3000`        |
| `DATABASE_URL` | Conexión con PostgreSQL                                                           | Obligatoria   |
| `CORS_ORIGINS` | Orígenes del navegador permitidos, separados por comas. La app nativa no usa CORS | Ninguno       |
| `LOG_LEVEL`    | Nivel de los logs de pino                                                         | `info`        |
| `TRUST_PROXY`  | Cantidad de proxies delante de la API (1 en Railway o Render)                     | `0`           |

## Convenciones

- **Versión en la URL:** todas las rutas van bajo `/v1`.
- **Errores:** todas las respuestas de error tienen la forma `{ statusCode, errorCode, message, details? }`.
  - `errorCode` es estable y en inglés; el cliente decide qué hacer según ese valor.
  - `message` va en español, porque el cliente se lo muestra al usuario.
  - Para un error de negocio, lanza la excepción de Nest con su `errorCode` y un mensaje en español: `throw new ConflictException('Ese horario ya está tomado.', { errorCode: 'SLOT_TAKEN' })`.
  - Cualquier error sin `errorCode` sale con un mensaje genérico, para que los detalles internos no lleguen al cliente.
- **Validación:** los DTO usan class-validator y van en archivos `*.dto.ts`, para que el plugin de Swagger los documente. Se rechazan las propiedades que el DTO no declara, y los errores de cada campo llegan en `details`.
- **Logs:** pino en JSON, legibles con pino-pretty en desarrollo. Cada petición registra solo su ID, método, URL y estado, y cada respuesta trae el encabezado `x-request-id`.

## Contrato OpenAPI

[openapi.json](openapi.json) va en git porque es el contrato del que se genera el cliente de las apps. Después de cambiar un controlador o un DTO, corre `pnpm openapi:generate` y haz commit del resultado. El script compila la API y escribe el documento sin levantar el servidor ni conectarse a la base de datos. El CI lo vuelve a generar y falla si quedó desactualizado.

## Base de datos

- **Prisma 7.10.1**, fijado en versión exacta en `prisma`, `@prisma/client` y `@prisma/adapter-pg`. La etiqueta `latest` de `prisma` en npm apunta a `8.0.0-rc`.
- El esquema está en [prisma/schema.prisma](prisma/schema.prisma) y la configuración del CLI en [prisma.config.ts](prisma.config.ts).
- El cliente se genera en `src/generated/prisma` y no va en git. Turbo lo genera antes de `lint`, `typecheck`, `test` y `build`, y `pnpm dev` también. Si corres Vitest directamente después de cambiar el esquema, corre antes `pnpm generate`.

## Pruebas

- **Unitarias:** `src/**/*.spec.ts`.
- **De integración:** `test/**/*.e2e-spec.ts`. Levantan un PostgreSQL 18 real con Testcontainers, así que **necesitan Docker**. Aplican las migraciones y arrancan el `AppModule` completo con la misma configuración HTTP que `main.ts` (ver `test/create-test-app.ts`).

## Comandos

| Comando                 | Qué hace                                                                 |
| ----------------------- | ------------------------------------------------------------------------ |
| `pnpm dev`              | Servidor de desarrollo con recarga automática                            |
| `pnpm build`            | Compila a `dist/`                                                        |
| `pnpm start:prod`       | Corre la versión compilada                                               |
| `pnpm generate`         | Genera el cliente de Prisma                                              |
| `pnpm openapi:generate` | Vuelve a generar `openapi.json`                                          |
| `pnpm lint`             | oxlint con reglas que usan los tipos                                     |
| `pnpm typecheck`        | Revisión de tipos                                                        |
| `pnpm test`             | Pruebas unitarias y de integración (las de integración necesitan Docker) |
| `pnpm test:unit`        | Solo las unitarias                                                       |
| `pnpm test:integration` | Solo las de integración                                                  |
| `pnpm test:watch`       | Unitarias en modo watch                                                  |
| `pnpm test:cov`         | Cobertura                                                                |
