# @pawie/api

API REST de Pawie Care, hecha con NestJS 12. Las reglas de negocio que implementa están en [docs/reglas-de-negocio.md](../../docs/reglas-de-negocio.md) y su diseño en [docs/arquitectura.md](../../docs/arquitectura.md).

## Desarrollo

```bash
pnpm infra:up              # desde la raíz: PostgreSQL, Redis y Mailpit
cp .env.example .env
pnpm db:deploy             # aplica las migraciones
pnpm db:seed               # carga el catálogo, los parámetros y los cuidadores de demo
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
- **Convenciones del esquema:**
  - Los IDs son UUIDv7 y los genera PostgreSQL con `uuidv7()`.
  - El dinero va en centavos (`…Cents`) y los porcentajes en puntos básicos (`…Bp`).
  - Los instantes van en `timestamptz(3)` y las fechas de calendario en `date`.
  - Las horas del día van en minutos desde la medianoche, en hora de El Salvador.
  - El esquema cita las reglas (`RN-XXX-00`) junto a cada modelo.

### Migraciones

Están en [prisma/migrations](prisma/migrations):

- `…_init` la generó Prisma a partir del esquema.
- `…_constraints` está escrita a mano, porque Prisma no puede expresar lo que tiene:
  - `btree_gist` y la restricción de exclusión `booking_slots_no_overlap`, que impide que un cuidador tenga tramos que se crucen (RN-CUI-15);
  - los `CHECK`;
  - los índices únicos parciales: una sola certificación activa por tipo y un solo pago aprobado por reserva.

Para cambiar el esquema:

1. Edita [prisma/schema.prisma](prisma/schema.prisma).
2. Corre `pnpm db:migrate --name <qué-cambia>`, que crea la migración y la aplica a tu base local.
3. Corre `pnpm generate`. Desde Prisma 7, `migrate dev` ya no genera el cliente; `pnpm dev` y Turbo sí lo hacen.

Para algo que Prisma no puede expresar, como otro `CHECK`, crea la migración vacía con `pnpm db:migrate --create-only --name <qué-cambia>`, escribe el SQL y aplícala con `pnpm db:migrate`.

Prisma no borra lo que está escrito a mano mientras la preview `partialIndexes` siga apagada. Si algún día se activa, hay que declarar en el esquema los índices parciales que hoy están en la migración. La prueba `test/database/migrations.e2e-spec.ts` falla si el esquema y las migraciones dejan de coincidir, o si Prisma intentaría borrar algo de lo escrito a mano.

Otros comandos:

- `pnpm db:deploy` aplica las migraciones pendientes sin crear nuevas. Es el que se usa al desplegar.
- Para empezar de cero en local, corre `pnpm exec prisma migrate reset` y después `pnpm db:seed`. Prisma 7 ya no corre el seed por su cuenta.

### Seed

`pnpm db:seed` compila la API y corre `prisma db seed`, que ejecuta `dist/seed/seed.js`. Node no puede correr el cliente generado directamente desde TypeScript. Carga:

- los 14 distritos del AMSS, perro y gato, los dos servicios y el tipo de certificación ⭐;
- todos los parámetros de la sección 15 que falten, con su valor inicial;
- 10 cuidadores aprobados y con Reserva inmediata. Hay de los cuatro tipos (⭐, estudiantes, ambos y ninguno), y Gabriela, Diego y Sofía no hacen pernoctas. Sus correos son de `example.com` y no tienen contraseña, así que no pueden iniciar sesión.

Se puede correr las veces que quieras:

- los registros se actualizan por su clave natural (slug, código o correo);
- los distritos, precios, horario y ⭐ de cada cuidador se reemplazan;
- un parámetro que ya existe **conserva su valor**, así que el seed nunca deshace un `settings:set`;
- las fechas, como la vigencia de la ⭐, se calculan desde el día en que corre, para que la demo no caduque.

### Parámetros

Los parámetros de la sección 15 de las reglas viven en la tabla `settings`.

- Cada clave está en [src/settings/settings.registry.ts](src/settings/settings.registry.ts), con su validador, su valor inicial y la regla que implementa.
- En el código se leen con `SettingsService.get()`, que valida el valor y falla si falta o no es válido.
- Las duraciones van en minutos o días, según lo diga la clave; los porcentajes, en puntos básicos; el dinero, en centavos; y las calificaciones, en décimas (40 es 4.0).

Para cambiar uno:

```bash
pnpm settings:set pricing.ownerServiceFeeBp 1200 --by Ana --reason "Prueba de precios"
pnpm settings:set services.overnightHours '{"startMinute":1200,"endMinute":480}'
```

- El valor va en JSON y se valida antes de guardarlo.
- El cambio queda en `setting_changes` con el valor anterior, quién lo hizo (`--by`, por defecto tu usuario del sistema) y por qué (`--reason`).
- Si la clave no existe, el script muestra la lista de claves.
- En Windows PowerShell 5.1 hay que escapar las comillas internas del JSON: `'{\"startMinute\":1200,\"endMinute\":480}'`.

Para agregar un parámetro, súmalo al registro y a la tabla de la sección 15. Una prueba unitaria compara los dos. Después corre `pnpm db:seed`, que lo crea con su valor inicial.

## Pruebas

- **Unitarias:** `src/**/*.spec.ts`.
- **De integración:** `test/**/*.e2e-spec.ts`. Levantan un PostgreSQL 18 real con Testcontainers, así que **necesitan Docker**. Aplican las migraciones y arrancan el `AppModule` completo con la misma configuración HTTP que `main.ts` (ver `test/create-test-app.ts`).
  - Cada archivo que escribe datos pide su propia base con `createTestDatabase()` ([test/database.ts](test/database.ts)), que es una copia vacía de la base ya migrada. Así los archivos corren en paralelo sin ver los datos de los otros.
  - [test/factories.ts](test/factories.ts) crea las filas mínimas válidas: usuarios, cuidadores, mascotas y reservas con sus tramos.

## Comandos

| Comando                 | Qué hace                                                                 |
| ----------------------- | ------------------------------------------------------------------------ |
| `pnpm dev`              | Servidor de desarrollo con recarga automática                            |
| `pnpm build`            | Compila a `dist/`                                                        |
| `pnpm start:prod`       | Corre la versión compilada                                               |
| `pnpm generate`         | Genera el cliente de Prisma                                              |
| `pnpm db:migrate`       | Crea una migración desde el esquema y la aplica a la base local          |
| `pnpm db:deploy`        | Aplica las migraciones pendientes                                        |
| `pnpm db:seed`          | Carga el catálogo, los parámetros y los cuidadores de demo               |
| `pnpm settings:set`     | Cambia un parámetro y lo registra en el historial                        |
| `pnpm openapi:generate` | Vuelve a generar `openapi.json`                                          |
| `pnpm lint`             | oxlint con reglas que usan los tipos                                     |
| `pnpm typecheck`        | Revisión de tipos                                                        |
| `pnpm test`             | Pruebas unitarias y de integración (las de integración necesitan Docker) |
| `pnpm test:unit`        | Solo las unitarias                                                       |
| `pnpm test:integration` | Solo las de integración                                                  |
| `pnpm test:watch`       | Unitarias en modo watch                                                  |
| `pnpm test:cov`         | Cobertura                                                                |
