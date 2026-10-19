# @pawie/mobile

App móvil de Pawie Care para iOS y Android, hecha con Expo SDK 58 y Expo Router. Las pantallas viven en `src/app/`: cada archivo es una ruta.

## Correr la app

```bash
pnpm android   # emulador de Android (Android Studio, en Windows o macOS)
pnpm ios       # simulador de iOS (Xcode, solo en macOS)
```

El emulador o el simulador tiene que estar abierto antes de correr el comando.

## Conectarse a la API

La app usa la API local, que se levanta con `pnpm dev` en `apps/api`:

- **Emulador de Android:** la API está en `http://10.0.2.2:3000`.
- **Simulador de iOS:** la API está en `http://localhost:3000`.

Para usar otra, como la de la demo desplegada, pon `EXPO_PUBLIC_API_URL=https://…` en `apps/mobile/.env.local` y reinicia Expo.

Para entrar, usa el dueño de demo del seed: `demo@example.com`, con la contraseña de `DEMO_OWNER_PASSWORD` (en local, `pawie-demo-local`). Tiene tres mascotas: Toby, Nala y Rocky.

- **Sesión:** está en `src/lib/session.ts`. El refresh token se guarda en `expo-secure-store`, así que la sesión sigue al cerrar la app.
- **Datos:** los hooks de `@pawie/api-client` funcionan dentro del `QueryClientProvider` de `src/app/_layout.tsx`. La configuración está en `src/lib/api.ts`.

## Diseño

Las pantallas siguen los mockups y el design system de [docs/design](../../docs/design/README.md).

- `src/theme/tokens.ts` tiene los colores, el espaciado, los radios, la sombra y la tipografía de `docs/design/tokens.json`. Si cambias uno, cambia el otro.
- `src/components/` tiene los componentes:
  - `Text`, `Button`, `Input`, `Card`, `Tag` y `StepBar`;
  - `Icon`, `IconButton`, `Banner`, `Chip`, `Avatar` y `TabBar`.

  Usa siempre este `Text` y no el de React Native, porque es el que aplica Nunito. En desarrollo, todos se ven en la ruta `/catalogo`, con un enlace desde Cuenta.

- **Íconos:** son de Lucide, y salen de los datos de Iconify. Para agregar uno, pon su nombre (lo encuentras en [icon-sets.iconify.design/lucide](https://icon-sets.iconify.design/lucide/)) en la lista de `scripts/generate-icons.mjs` y corre `pnpm icons`.
- Nunito se carga en `src/app/_layout.tsx`, y la pantalla de carga sigue visible hasta que termina.
- Reglas del design system: un solo botón primario por pantalla, nada de naranja, `butter` solo para la ⭐ y para avisos (en `Tag`, los tonos `certified` y `warning`) y Nimbus como máximo una vez por pantalla.

## Agregar dependencias

Usa `pnpm exec expo install <paquete>` en vez de `pnpm add`, porque elige la versión compatible con el SDK de Expo. Si una librería trae código nativo, la app necesita una development build (`pnpm exec expo run:android` o `run:ios`) en lugar de Expo Go.

## Comandos

| Comando          | Qué hace                                                                           |
| ---------------- | ---------------------------------------------------------------------------------- |
| `pnpm dev`       | Inicia el servidor de Expo                                                         |
| `pnpm lint`      | ESLint con la configuración de Expo                                                |
| `pnpm typecheck` | Revisión de tipos                                                                  |
| `pnpm icons`     | Genera `src/components/icons.generated.ts` con los íconos de Lucide que usa la app |

ESLint está fijado en la versión 9 porque los plugins de `eslint-config-expo` todavía no son compatibles con la 10.
