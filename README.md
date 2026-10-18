# Pawie Care

Marketplace que conecta a dueños de mascotas con cuidadores en San Salvador, El Salvador. Los cuidadores con la certificación ⭐ pueden atender cuidados especiales: mascotas mayores, recién operadas o con condiciones de salud.

## Documentación

- [Reglas de negocio](docs/reglas-de-negocio.md)
- [Arquitectura y stack técnico](docs/arquitectura.md)

## Estructura

```
apps/
  api/          API REST (NestJS)
  mobile/       App iOS y Android (Expo)
packages/
  api-client/   Cliente de la API para las apps, generado con Orval desde el contrato OpenAPI
docs/           Reglas de negocio y arquitectura
```

## Requisitos

- **Node.js 24.7 o más** (la API usa `crypto.argon2`). La versión está en `.node-version`; con fnm basta con `fnm use`.
- **pnpm**, que se activa con `corepack enable`. La versión exacta está en `package.json`.
- **Docker**, para PostgreSQL, Redis, Mailpit y SeaweedFS (los archivos), y para las pruebas de integración de la API.
- **Android Studio** para el emulador de Android, o **Xcode** en macOS para el simulador de iOS.

## Primeros pasos

```bash
corepack enable
pnpm install
pnpm infra:up                         # PostgreSQL, Redis, Mailpit y SeaweedFS
cp apps/api/.env.example apps/api/.env
pnpm --filter @pawie/api db:deploy    # crea las tablas
pnpm --filter @pawie/api db:seed      # catálogo, parámetros y cuidadores de demo
pnpm --filter @pawie/api dev          # API en http://localhost:3000 y documentación en /docs
pnpm --filter @pawie/mobile android   # o "ios" en macOS
```

## Comandos

| Comando                             | Qué hace                                         |
| ----------------------------------- | ------------------------------------------------ |
| `pnpm dev`                          | Levanta la API y la app móvil en modo desarrollo |
| `pnpm lint`                         | Revisa el código de todos los paquetes           |
| `pnpm typecheck`                    | Revisa los tipos de TypeScript                   |
| `pnpm test`                         | Corre los tests (los de la API necesitan Docker) |
| `pnpm build`                        | Compila lo que se despliega                      |
| `pnpm format`                       | Formatea todo el repositorio con Prettier        |
| `pnpm infra:up` / `pnpm infra:down` | Levanta o detiene la infraestructura local       |

Antes de cada commit, un hook formatea los archivos modificados. GitHub Actions corre formato, lint, tipos, tests y build en cada push y en cada pull request, y revisa que el contrato `apps/api/openapi.json` y el cliente generado `packages/api-client` estén al día.
