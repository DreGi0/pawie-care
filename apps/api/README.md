# @pawie/api

API REST de Pawie Care, hecha con NestJS 12. Las reglas de negocio que implementa están en [docs/reglas-de-negocio.md](../../docs/reglas-de-negocio.md) y su diseño en [docs/arquitectura.md](../../docs/arquitectura.md).

## Desarrollo

```bash
pnpm infra:up              # desde la raíz: PostgreSQL, Redis, Mailpit y SeaweedFS
cp .env.example .env
pnpm db:deploy             # aplica las migraciones
pnpm db:seed               # carga el catálogo, los parámetros y los cuidadores de demo
pnpm dev                   # genera el cliente de Prisma y levanta http://localhost:3000
```

- **Estado:** <http://localhost:3000/v1/health> revisa la conexión con la base de datos y con Redis, y responde 200, o 503 si algo falla.
- **Documentación:** Swagger UI en <http://localhost:3000/docs>, y el documento OpenAPI en <http://localhost:3000/docs/openapi.json>.

## Configuración

Las variables de entorno se validan al arrancar, en [src/config/environment.ts](src/config/environment.ts). Si falta una o tiene un valor inválido, la API no arranca y dice cuál es. Están todas en [.env.example](.env.example).

| Variable                                                | Para qué                                                                                                              | Por defecto   |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------- |
| `NODE_ENV`                                              | `development`, `test` o `production`. En `development` los logs son legibles                                          | `development` |
| `PORT`                                                  | Puerto HTTP                                                                                                           | `3000`        |
| `DATABASE_URL`                                          | Conexión con PostgreSQL                                                                                               | Obligatoria   |
| `CORS_ORIGINS`                                          | Orígenes del navegador permitidos, separados por comas. La app nativa no usa CORS                                     | Ninguno       |
| `LOG_LEVEL`                                             | Nivel de los logs de pino                                                                                             | `info`        |
| `TRUST_PROXY`                                           | Cantidad de proxies delante de la API (1 en Railway o Render)                                                         | `0`           |
| `JWT_ACCESS_SECRET`                                     | Firma los tokens de acceso. Mínimo 32 caracteres, y uno distinto en cada entorno desplegado                           | Obligatoria   |
| `JWT_ACCESS_TTL_SECONDS`                                | Duración del token de acceso, en segundos                                                                             | `900`         |
| `REFRESH_TOKEN_TTL_DAYS`                                | Duración del refresh token, en días                                                                                   | `30`          |
| `REDIS_URL`                                             | Redis de las colas de BullMQ: los plazos de las reservas y la limpieza                                                | Obligatoria   |
| `DEMO_OWNER_PASSWORD`                                   | Contraseña del dueño de demo que crea el seed. Sin ella, el seed no lo crea                                           | Ninguna       |
| `S3_ENDPOINT`                                           | Almacenamiento compatible con S3: el SeaweedFS de `docker-compose.yml` en local y Cloudflare R2 en la demo desplegada | Obligatoria   |
| `S3_PUBLIC_ENDPOINT`                                    | Host de las URLs firmadas que usan las apps. En el emulador de Android es `http://10.0.2.2:8333`                      | `S3_ENDPOINT` |
| `S3_REGION`                                             | Región. R2 usa `auto` y SeaweedFS acepta cualquiera                                                                   | `auto`        |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Bucket privado y su llave de acceso                                                                                   | Obligatorias  |

## Convenciones

- **Versión en la URL:** todas las rutas van bajo `/v1`.
- **Errores:** todas las respuestas de error tienen la forma `{ statusCode, errorCode, message, details? }`.
  - `errorCode` es estable y en inglés; el cliente decide qué hacer según ese valor.
  - `message` va en español, porque el cliente se lo muestra al usuario.
  - Para un error de negocio, lanza la excepción de Nest con su `errorCode` y un mensaje en español: `throw new ConflictException('Ese horario ya está tomado.', { errorCode: 'SLOT_TAKEN' })`.
  - Cualquier error sin `errorCode` sale con un mensaje genérico, para que los detalles internos no lleguen al cliente.
- **Validación:** los DTO usan class-validator y van en archivos `*.dto.ts`, para que el plugin de Swagger los documente. Se rechazan las propiedades que el DTO no declara, y los errores de cada campo llegan en `details`.
- **Logs:** pino en JSON, legibles con pino-pretty en desarrollo. Cada petición registra solo su ID, método, URL y estado, y cada respuesta trae el encabezado `x-request-id`.
- **Rutas protegidas por defecto:** toda ruta exige un token de acceso salvo las marcadas con `@Public()`. Si una ruta nueva debe ser pública, márcala; si no, documéntala con `@ApiBearerAuth()`. El usuario de la petición se lee con `@CurrentUser()`.

## Autenticación

Implementa RN-CTA-01 y RN-CTA-02, según §4.4 de la arquitectura. Por ahora solo existe el modo de la app móvil: el token va en `Authorization: Bearer`. Las cookies y la protección CSRF para la web llegan con la web.

| Ruta                     | Qué hace                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| `POST /v1/auth/register` | Crea una cuenta de dueño e inicia sesión. Solo mayores de 18 años, según la fecha en El Salvador |
| `POST /v1/auth/login`    | Inicia sesión                                                                                    |
| `POST /v1/auth/refresh`  | Cambia el refresh token por un par nuevo                                                         |
| `POST /v1/auth/logout`   | Cierra la sesión de ese refresh token                                                            |
| `GET /v1/users/me`       | Los datos de la cuenta que inició sesión                                                         |

- **Contraseñas:** se guardan con argon2id de `node:crypto`, en formato PHC ([src/auth/passwords.ts](src/auth/passwords.ts)), y tienen entre 8 y 128 caracteres.
- **Token de acceso:** es un JWT HS256 que dura `JWT_ACCESS_TTL_SECONDS`. Cuando una ruta responde 401 `UNAUTHORIZED`, la app tiene que renovarlo.
- **Refresh token:** es opaco, dura `REFRESH_TOKEN_TTL_DAYS` y en la base solo queda su SHA-256.
  - `refresh` devuelve uno nuevo. El anterior sigue sirviendo 30 segundos, para que la app pueda reintentar si se pierde la respuesta o mandar dos `refresh` a la vez.
  - Después de esos 30 segundos, usar otra vez uno ya cambiado significa que alguien más lo tiene: se revocan todos los tokens de esa sesión y responde `INVALID_REFRESH_TOKEN`.
- **Errores:**
  - `EMAIL_TAKEN` (409): ya hay una cuenta con ese correo.
  - `UNDERAGE` (422): es menor de 18 años.
  - `INVALID_CREDENTIALS` (401): el correo o la contraseña no son correctos. Responde igual si el correo no existe.
  - `INVALID_REFRESH_TOKEN` (401): hay que iniciar sesión de nuevo.
- **Límites por IP:** 5 registros, 10 inicios de sesión y 30 `refresh` por minuto.

Para probarlo con el dueño de demo (ver [Seed](#seed)):

```bash
curl -s -X POST localhost:3000/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"demo@example.com","password":"pawie-demo-local"}'
curl -s localhost:3000/v1/users/me -H "authorization: Bearer <accessToken>"
```

## Archivos

Las fotos y los documentos van en un bucket privado (arquitectura §4.11). La app los sube directo al bucket, sin pasar por la API:

1. `POST /v1/files` con `purpose`, `contentType` y `sizeBytes` exacto. Devuelve `uploadUrl` y `uploadHeaders`.
2. `PUT` del archivo a `uploadUrl` con esos headers. El tipo y el tamaño van firmados: si no coinciden, el bucket responde 403.
3. `POST /v1/files/:id/complete`. A partir de ahí el archivo se puede asignar a una mascota, una vacuna o unas indicaciones.

- **Límites:** las fotos (`PET_PHOTO`) aceptan JPEG, PNG, WebP o HEIC de hasta 10 MB. Las recetas (`VET_INSTRUCTION`) y los carnés de vacunas (`VACCINATION_RECORD`) aceptan además PDF, hasta 15 MB.
- **Descargas:** las URLs que devuelve la API vencen en 10 minutos. `GET /v1/files/:id` da una nueva.
- **Emulador de Android:** pon `S3_PUBLIC_ENDPOINT=http://10.0.2.2:8333`. Si no, las URLs apuntan a `localhost`, que dentro del emulador es el propio emulador.

## Mascotas

`/v1/pets` implementa RN-MAS. Cada dueño solo ve sus mascotas; para las de otros, y para las archivadas, responde 404 `PET_NOT_FOUND`.

- `PUT /v1/pets/:id` reemplaza la mascota completa: un campo opcional que no se manda queda vacío. `DELETE` la archiva.
- Las vacunas, las indicaciones del veterinario y las tareas de cuidado van en subrutas.
- **Tareas de cuidado:** los grupos están en [src/pets/care-tasks.ts](src/pets/care-tasks.ts). Las reglas se validan con estos errores claros, antes de llegar a los `CHECK` de la base:
  - las clínicas piden `vetInstructionId` (`VET_INSTRUCTIONS_REQUIRED`);
  - las de asistencia piden `ownerInstructions` (`OWNER_INSTRUCTIONS_REQUIRED`);
  - solo pueden quedar sin fecha de fin las que lo permiten (`END_DATE_REQUIRED`).
- [src/pets/care-level.ts](src/pets/care-level.ts) calcula si una mascota es Normal o Especial en ciertas fechas (RN-MAS-04 a 07), y qué tareas prohibidas tiene activas (RN-MAS-09).

## Búsqueda de cuidadores

`POST /v1/caregivers/search` (RN-RES-01) recibe `petIds`, `districtId`, `serviceCode` y el horario:

- **Pernocta:** `nights` es la fecha en que empieza cada noche, de 19:00 a 08:00 del día siguiente. Puede llevar `visits` durante la estadía (RN-SER-03).
- **Visita:** `visits` es la hora en que empieza cada una, con zona horaria. Cada visita dura 60 min.

[src/bookings/slot-plan.ts](src/bookings/slot-plan.ts) convierte eso en tramos, los mismos que usa la reserva.

La respuesta trae el nivel de la reserva, los tramos y los cuidadores disponibles. Un cuidador aparece si:

- está aprobado, activo y sin suspensión;
- cubre el distrito;
- ofrece cada servicio en ese nivel, y si la reserva es Especial, tiene la ⭐ vigente hasta el último día;
- tiene ventanas en su horario semanal para todos los tramos y no tiene otro tramo que se cruce.

Los resultados van ordenados por calificación y después por servicios completados.

- **Errores:**
  - `TOO_MANY_PETS` (RN-RES-03);
  - `INVALID_SCHEDULE`;
  - `TOO_SOON` (RN-RES-05);
  - `PET_NOT_BOOKABLE` (RN-MAS-09), con un mensaje que explica el motivo y las mascotas y tareas en `details`;
  - `UNKNOWN_DISTRICT`.
- **Precios:** son por una mascota. Si el cuidador no fijó uno, se usa el sugerido, y siempre se ajustan al rango vigente (RN-CUI-17). El recargo por mascota adicional y la tarifa de servicio se calculan al reservar.
- **Perfil:** `GET /v1/caregivers/:id` (RN-RES-02) muestra la ⭐, la insignia de estudiante, la calificación, los distritos y los precios. Los de nivel Especial solo aparecen si el cuidador tiene la ⭐.

## Direcciones

`/v1/addresses` lista, crea, reemplaza (`PUT`) y borra las direcciones del dueño. Cada una tiene un nombre (`label`, como "Casa"), la calle, indicaciones opcionales y el distrito. Una reserva copia la dirección que usa (RN-CTA-04), así que editarla o borrarla después no cambia la reserva. Para las de otro dueño responde 404 `ADDRESS_NOT_FOUND`.

## Reservas

`/v1/bookings` implementa RN-RES-03 a RN-RES-07 y RN-CAN-07. Cada dueño solo ve sus reservas; para las de otros responde 404 `BOOKING_NOT_FOUND`.

### Cómo se reserva

`POST /v1/bookings` recibe lo mismo que la búsqueda, con un cuidador de los resultados y una dirección en vez del distrito:

```json
{
  "caregiverId": "…",
  "serviceCode": "HOME_VISIT",
  "visits": ["2026-11-20T15:00:00-06:00"],
  "petIds": ["…"],
  "addressId": "…",
  "instructions": "La comida está en la alacena.",
  "emergency": {
    "contactName": "Luis Pérez",
    "contactPhone": "+503 7000 0000",
    "vetName": "Clínica San Benito",
    "vetPhone": "+503 2222 0000",
    "preauthorizedCents": 5000,
    "clinicConsent": true
  }
}
```

- **Validación:** usa `planBooking()` y `bookableCaregiver()` de [CaregiversService](src/caregivers/caregivers.service.ts), igual que la búsqueda, así que nunca reserva a un cuidador que la búsqueda no mostraría. El distrito sale de la dirección.
- **Datos de emergencia (RN-RES-04):** sin `clinicConsent: true` no se puede reservar. El monto preautorizado solo se declara; no se cobra.
- **Lo que guarda la reserva:**
  - el nivel de cuidado de cada mascota en esas fechas; con una sola mascota Especial, toda la reserva es Especial (RN-PRE-02);
  - una copia de la dirección (RN-CTA-04);
  - los precios, los porcentajes y `pricing_snapshot` vigentes al crearla (RN-PRE-07);
  - las indicaciones del veterinario de las tareas clínicas activas en esas fechas (RN-RES-03).
- **Precios ([src/pricing/booking-price.ts](src/pricing/booking-price.ts)):** cada tramo es el precio del cuidador más 50% por mascota adicional; las visitas de día de una pernocta van al precio de visita del mismo nivel (RN-SER-03). El subtotal es la suma de los tramos, la tarifa y la comisión son porcentajes del subtotal, y el cuidador recibe el subtotal menos la comisión. Cada monto se redondea una vez, con la mitad hacia arriba (RN-PRE-08). Una visita Especial de $17 le cuesta al dueño $18.70 y le deja al cuidador $14.45.
- **Errores:** los de la búsqueda, más:
  - `ADDRESS_NOT_FOUND` (404);
  - `SLOT_TAKEN` (409): otra reserva tomó ese horario, antes de revisarlo o al mismo tiempo (la restricción de exclusión falla con 23P01);
  - `CAREGIVER_UNAVAILABLE` (409): la búsqueda ya no mostraría a ese cuidador para esa reserva, por ejemplo porque cambió su horario.

### Estados

La tabla de transiciones está en [src/bookings/booking-status.ts](src/bookings/booking-status.ts) (arquitectura §4.7):

| Desde             | Hacia                | Cuándo                                                                     |
| ----------------- | -------------------- | -------------------------------------------------------------------------- |
| (nueva)           | `PENDING_PAYMENT`    | El cuidador tiene Reserva inmediata (RN-CUI-16), como todos los de la demo |
| (nueva)           | `REQUESTED`          | El cuidador no tiene Reserva inmediata                                     |
| `REQUESTED`       | `PENDING_PAYMENT`    | El cuidador acepta                                                         |
| `REQUESTED`       | `REJECTED`           | El cuidador rechaza                                                        |
| `REQUESTED`       | `EXPIRED`            | El cuidador no responde a tiempo (RN-RES-06)                               |
| `PENDING_PAYMENT` | `CONFIRMED`          | Wompi aprueba el pago (Etapa 6)                                            |
| `PENDING_PAYMENT` | `EXPIRED`            | El dueño no paga a tiempo (RN-RES-07)                                      |
| `REQUESTED`       | `CANCELLED_BY_OWNER` | El dueño cancela sin costo (RN-CAN-07)                                     |
| `PENDING_PAYMENT` | `CANCELLED_BY_OWNER` | El dueño cancela sin costo (RN-CAN-07)                                     |
| `EXPIRED`         | `CONFIRMED`          | Un pago aprobado tarde, si el horario sigue libre (Etapa 6)                |

- `BookingStateMachine` aplica cada cambio en una transacción: `status` y `blocks_calendar` juntos y un `BookingStatusChange`. Solo cambia una reserva que sigue en el estado que se leyó; si no, responde 409 `BOOKING_STATUS_CHANGED`.
- `REQUESTED` ya bloquea el horario. `REJECTED`, `EXPIRED` y las cancelaciones lo liberan.
- No hay panel de cuidador, así que aceptar y rechazar existen solo como `BookingsService.accept()` y `reject()`, sin ruta.
- `GET /v1/bookings/:id` muestra el teléfono del cuidador desde que la reserva está confirmada (RN-CTA-04). Los cuidadores de demo no tienen teléfono en el seed.
- `POST /v1/bookings/:id/cancel` cancela sin costo, con un `reason` opcional, mientras está `REQUESTED` o `PENDING_PAYMENT`. En otro estado responde 409 `BOOKING_NOT_CANCELLABLE`.

### Plazos

[src/bookings/deadlines.ts](src/bookings/deadlines.ts) calcula cada plazo, que vence en su duración o al inicio del primer tramo, lo que ocurra primero:

- **Respuesta del cuidador (RN-RES-06):** 24 h si faltan más de 72 h para el servicio, 6 h si faltan de 24 a 72 h (con exactamente 72 h o 24 h también) y 1 h si faltan menos de 24 h.
- **Pago (RN-RES-07):** 2 h desde que la reserva pasa a `PENDING_PAYMENT`.

La respuesta trae `responseDueAt` mientras está `REQUESTED` y `paymentDueAt` mientras está `PENDING_PAYMENT`. Cómo se vencen está en [Colas y tareas](#colas-y-tareas).

## Colas y tareas

BullMQ corre sobre el Redis de `REDIS_URL` (arquitectura §4.10), con los workers dentro de la API. Las claves de Redis empiezan con `pawie:`.

- **`booking-deadlines`** ([src/bookings/booking-deadlines.ts](src/bookings/booking-deadlines.ts)):
  - al crear una reserva, y cuando el cuidador acepta, se agenda una tarea diferida que la vence al cumplirse el plazo;
  - antes de actuar, la tarea vuelve a leer la reserva, y solo la vence si sigue esperando en ese estado y el plazo ya pasó;
  - si Redis no responde en 2 segundos al agendarla, la reserva se crea igual; cada 5 minutos una tarea periódica vence las reservas con el plazo pasado, también las que Redis haya perdido.
- **`maintenance`** ([src/maintenance/maintenance.service.ts](src/maintenance/maintenance.service.ts)): cada hora borra los refresh tokens vencidos, y los archivos que nunca se terminaron de subir o que nadie usó en un día, con su objeto en el bucket.

Las tareas terminadas se borran de Redis, y las fallidas se quedan una semana. La API arranca aunque Redis no esté; `/v1/health` responde 503 y las tareas corren cuando vuelve.

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
- 10 cuidadores aprobados y con Reserva inmediata. Hay de los cuatro tipos (⭐, estudiantes, ambos y ninguno), y Gabriela, Diego y Sofía no hacen pernoctas. Sus correos son de `example.com` y no tienen contraseña, así que no pueden iniciar sesión;
- el dueño de demo, `demo@example.com`, con una dirección en San Salvador. Su contraseña es la de `DEMO_OWNER_PASSWORD`, que en local es `pawie-demo-local`. Sin esa variable, el seed no lo crea. En la demo desplegada, que tiene URL pública, usa otra contraseña. Tiene tres mascotas, una por cada caso de la demo: Toby es Normal; Nala es Especial porque necesita ayuda para moverse; y Rocky necesita insulina, así que no se puede reservar (RN-MAS-09);
- las fotos que haya en [seed-media/](seed-media/README.md), que se suben al bucket. La carpeta explica cómo nombrarlas.

Se puede correr las veces que quieras:

- los registros se actualizan por su clave natural (slug, código o correo);
- los distritos, precios, horario y ⭐ de cada cuidador se reemplazan;
- un parámetro que ya existe **conserva su valor**, así que el seed nunca deshace un `settings:set`;
- las fechas, como la vigencia de la ⭐, se calculan desde el día en que corre, para que la demo no caduque.

### Parámetros

Los parámetros de la sección 15 de las reglas viven en la tabla `settings`.

- Cada clave está en [src/settings/settings.registry.ts](src/settings/settings.registry.ts), con su validador, su valor inicial y la regla que implementa.
- En el código se leen con `SettingsService.get()`, o varios en una sola consulta con `getMany()`. Los dos validan cada valor y fallan si falta o no es válido.
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
- **De integración:** `test/**/*.e2e-spec.ts`. Levantan con Testcontainers un PostgreSQL 18, un SeaweedFS y un Redis 8 reales, así que **necesitan Docker**. Aplican las migraciones y arrancan el `AppModule` completo con la misma configuración HTTP que `main.ts` (ver `test/create-test-app.ts`).
  - Cada archivo que escribe datos pide su propia base con `createTestDatabase()` ([test/database.ts](test/database.ts)), que es una copia vacía de la base ya migrada. Así los archivos corren en paralelo sin ver los datos de los otros.
  - [test/factories.ts](test/factories.ts) crea las filas mínimas válidas: usuarios, cuidadores, mascotas y reservas con sus tramos.
  - [test/use-api.ts](test/use-api.ts) arranca la API contra la base de un archivo y firma tokens de acceso sin pasar por el inicio de sesión. [test/uploads.ts](test/uploads.ts) sube un archivo como lo hace la app.
  - Cada app de prueba usa su propio prefijo de colas en Redis ([test/create-test-app.ts](test/create-test-app.ts)), así que sus workers no toman las tareas de otra. [test/test-clock.ts](test/test-clock.ts) reemplaza el `Clock` para detener y adelantar el tiempo de los plazos.

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
