# Pawie Care

Marketplace de cuidadores de perros y gatos en San Salvador y Santa Tecla. Monorepo con pnpm y Turborepo:

- `apps/api`: API REST en NestJS, con Prisma y PostgreSQL.
- `apps/mobile`: app en Expo, con los modos dueño y cuidador.
- `packages/api-client`: cliente que Orval genera desde el OpenAPI.

## Fuente de verdad, en este orden

1. **[docs/reglas-de-negocio.md](docs/reglas-de-negocio.md) (v0.5):** qué hace el producto. Manda sobre todo lo demás.
2. **`apps/api/openapi.json`:** el contrato entre la API y la app.
3. **[docs/arquitectura.md](docs/arquitectura.md):** cómo se construye. Sus decisiones (§4) no se cambian sin actualizar el documento.
4. **[docs/design/](docs/design/README.md):** referencia visual y textos. Si contradice 1 o 2, mandan 1 y 2.

Los documentos de negocio del equipo (Buyer, Promesa, Vehículo y Pricing) **no están en el repo**; las reglas v0.5 ya los traducen. Si una tarea necesita algo que las reglas no dicen, pregunta: no lo inventes.

## Estado actual

- El código del commit `d088fba` implementa las **reglas v0.4**: precio por nivel de la mascota, tarifa de 10% y comisión de 15%, solo visita y pernocta, y sin app del cuidador.
- Lo que falta para la v0.5 está en **[docs/plan-v0.5.md](docs/plan-v0.5.md)**, en las etapas 6 a 12b.
- Si el código contradice las reglas v0.5, no es un bug que haya que respetar: es trabajo pendiente de una etapa. Revisa el plan antes de "arreglarlo" fuera de su etapa.

## Cómo trabajar una tarea

1. **Ubica la etapa** en `docs/plan-v0.5.md` y lee las reglas que cita, por su ID (`RN-XXX-00`).
2. **Una etapa por rama y por PR**, con commits convencionales (`feat(api): …`, `feat(mobile): …`, `docs: …`). Si es grande, divídela en API y app.
3. **La API primero.** Las reglas de negocio viven solo en la API (arquitectura §4.2): la app muestra resultados, no calcula precios, niveles ni permisos.
4. **Si cambias un DTO o un endpoint**, regenera y commitea el contrato y el cliente. El CI falla si quedaron viejos:
   ```bash
   pnpm --filter @pawie/api openapi:generate
   pnpm --filter @pawie/api-client generate
   ```
5. **Base de datos:**
   - Cambia `prisma/schema.prisma` y crea la migración con `pnpm --filter @pawie/api db:migrate`.
   - Los `CHECK`, las exclusiones y los índices parciales van en SQL escrito a mano dentro de la migración (arquitectura §4.8).
6. **Un parámetro con corchetes en las reglas**, como **[15%]**, va en `src/settings/settings.registry.ts`, con su regla, y en la tabla §15 de las reglas. Nunca como constante en el código.
7. **Cita el ID de la regla** en los comentarios y en los nombres de los tests que la cubren.
8. **Termina con todo en verde:**
   ```bash
   pnpm format && pnpm lint && pnpm typecheck && pnpm test
   ```
9. **Si cambia el comportamiento**, actualiza el doc que corresponda en el mismo PR: reglas, arquitectura, `docs/design/README.md` o el plan, donde se marca la etapa como hecha.

## Placeholders

- **`[DEFINIR: …]` en las reglas** es una decisión de negocio pendiente. Si tiene un valor provisional, úsalo y dilo en el PR. Si no lo tiene, detente y pregunta.
- **Contenido** (curso de bienvenida, árbol del asistente): crea la estructura y el seed con 2 o 3 ejemplos marcados como `TODO(contenido)`. El texto final lo escribe el equipo.

## App móvil

- Lee [apps/mobile/AGENTS.md](apps/mobile/AGENTS.md). Expo SDK 58 cambia APIs entre versiones: consulta la documentación versionada antes de usar un módulo.
- Instala con `npx expo install <paquete>` desde `apps/mobile`, nunca con `pnpm add`.
- Módulos nativos nuevos (`expo-location`, `expo-notifications`, `react-native-maps`, `expo-calendar`) necesitan la development build: `npx expo run:android` o `npx expo run:ios`.
- Componentes propios en `src/components/` y tokens en `src/theme/`. Sigue las reglas del design system de `docs/design/README.md`: un botón primario por pantalla, Nimbus como máximo una vez, `butter` solo para la ⭐.
- Datos del servidor siempre con los hooks de `@pawie/api-client` y TanStack Query.

## Entorno

- **Nada global.** Node se fija con `.node-version` (fnm) y pnpm con corepack. La infraestructura (PostgreSQL, Redis, Mailpit y SeaweedFS) corre en Docker: `pnpm infra:up`.
- Primera vez y datos de demo: ver [README.md](README.md). El dueño de demo es `demo@example.com` / `pawie-demo-local`.
- Cambiar un parámetro en local: `pnpm --filter @pawie/api settings:set <clave> <valor en JSON>`.

## Comandos

| Comando                                     | Qué hace                                           |
| ------------------------------------------- | -------------------------------------------------- |
| `pnpm dev`                                  | API y app en modo desarrollo                       |
| `pnpm --filter @pawie/api test:unit`        | Tests unitarios de la API, sin Docker              |
| `pnpm --filter @pawie/api test:integration` | Tests de integración de la API, con Testcontainers |
| `pnpm --filter @pawie/api db:seed`          | Carga los datos de demo                            |
| `pnpm --filter @pawie/mobile android`       | App en el emulador de Android                      |
| `pnpm --filter @pawie/mobile icons`         | Copia los íconos de Lucide que usa la app          |

## Convenciones

- **Código** (identificadores, tablas, endpoints, `errorCode`) en inglés. **Docs y textos de la app** en español. El glosario está en arquitectura §8.
- **Dinero** en centavos enteros, porcentajes en puntos básicos (1500 = 15%), instantes en UTC (`timestamptz`) que se muestran en `America/El_Salvador`.
- **IDs** UUIDv7 generados por PostgreSQL. **Errores** con la forma `{ statusCode, errorCode, message, details? }`.
- **Estados de las reservas** en español en los docs (`SOLICITADA`…) y en inglés en el código (`REQUESTED`…). La tabla de equivalencias está en el glosario de arquitectura §8.
- **Reservas:** solo cambian de estado con `BookingStateMachine` y las transiciones de `src/bookings/booking-status.ts`, cada una con su test.
