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

- **Node.js 24.7 hasta antes de 25** (`>=24.7 <25`; la API usa `crypto.argon2`). La versión está en `.node-version`; con fnm basta con `fnm use`.
- **pnpm**, que se activa con `corepack enable`. La versión exacta está en `package.json`.
- **Docker**, para PostgreSQL, Redis, Mailpit y SeaweedFS (los archivos), y para las pruebas de integración de la API.
- **Android Studio** para el emulador de Android, o **Xcode** en macOS para el simulador de iOS.

## Primeros pasos

```bash
corepack enable
pnpm install
pnpm infra:up
```

`pnpm infra:up` levanta PostgreSQL, Redis, Mailpit y SeaweedFS con Docker. La primera vez, crea la configuración local de la API y prepara la base de datos:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
pnpm --filter @pawie/api db:deploy
pnpm --filter @pawie/api db:seed
```

En macOS o Linux, usa `cp apps/api/.env.example apps/api/.env` en lugar de `Copy-Item`.

### Probar en el emulador de Android Studio

1. Abre Android Studio e inicia el emulador (por ejemplo, Pixel 10). Déjalo abierto.
2. En una terminal, desde la raíz del repo, inicia la API:

   ```bash
   pnpm --filter @pawie/api dev
   ```

3. En otra terminal, comprueba el estado de la API:

   ```powershell
   Invoke-RestMethod http://localhost:3000/v1/health
   ```

   Debe responder con `status: ok` y `up` para `database` y `redis`. Si responde `503` o no conecta, confirma que `pnpm infra:up` terminó correctamente y que aplicaste las migraciones. La API está en <http://localhost:3000>; Swagger, en <http://localhost:3000/docs>.

4. En una tercera terminal, desde la raíz, inicia Expo y abre la app en el emulador:

   ```bash
   pnpm --filter @pawie/mobile android
   ```

   Para iniciar Metro limpiando su caché:

   ```bash
   pnpm --filter @pawie/mobile android -- --clear
   ```

La app usa `http://10.0.2.2:3000` para alcanzar la API del equipo desde el emulador Android; no cambies esa dirección por `localhost` en la configuración de la app. Para probar con datos de demo, el seed crea `demo@example.com` con la contraseña local `pawie-demo-local` (configurable mediante `DEMO_OWNER_PASSWORD` en `apps/api/.env`).

Si las fotos de las mascotas no cargan en el emulador, configura `S3_PUBLIC_ENDPOINT=http://10.0.2.2:8333` en `apps/api/.env` y reinicia la API. Si cambias variables `EXPO_PUBLIC_*` en `apps/mobile/.env.local`, reinicia Expo para que tome los cambios.

### Probar en el simulador de iPhone (macOS)

1. Instala Xcode y sus herramientas de línea de comandos. Abre Xcode al menos una vez y acepta la instalación de componentes si lo solicita.
2. Abre la app **Simulator** desde Xcode (`Xcode > Open Developer Tool > Simulator`) y elige un dispositivo iPhone en `File > Open Simulator`. También puedes dejar que Expo abra el simulador disponible.
3. Asegúrate de que la infraestructura local esté arriba con `pnpm infra:up` y que ya hayas creado `apps/api/.env`, aplicado las migraciones y cargado el seed como se indica arriba.
4. En una terminal desde la raíz del repo, inicia la API:

   ```bash
   pnpm --filter @pawie/api dev
   ```

5. En otra terminal, comprueba que la API y sus dependencias respondan:

   ```bash
   curl http://localhost:3000/v1/health
   ```

   La respuesta debe incluir `"status":"ok"` y `"up"` tanto para `database` como para `redis`. La documentación de la API está en <http://localhost:3000/docs>.

6. En una tercera terminal, inicia Expo para iOS:

   ```bash
   pnpm --filter @pawie/mobile ios
   ```

   Para reiniciar Metro limpiando su caché, agrega la opción:

   ```bash
   pnpm --filter @pawie/mobile ios -- --clear
   ```

En el simulador de iOS, la app accede a la API y al almacenamiento local usando `localhost`; no configures `10.0.2.2`, que es exclusivo del emulador Android. Para iniciar sesión con datos de demo, usa `demo@example.com` y la contraseña local `pawie-demo-local` (o la definida en `DEMO_OWNER_PASSWORD` dentro de `apps/api/.env`).

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
