# @pawie/mobile

App móvil de Pawie Care para iOS y Android, hecha con Expo SDK 58 y Expo Router. Las pantallas viven en `src/app/`: cada archivo es una ruta.

## Correr la app

```bash
pnpm android   # emulador de Android (Android Studio, en Windows o macOS)
pnpm ios       # simulador de iOS (Xcode, solo en macOS)
```

El emulador o el simulador tiene que estar abierto antes de correr el comando. Para conectarse a la API local:

- **Emulador de Android:** la API está en `http://10.0.2.2:3000`.
- **Simulador de iOS:** la API está en `http://localhost:3000`.

## Diseño

Las pantallas siguen los mockups y el design system de [docs/design](../../docs/design/README.md).

- `src/theme/tokens.ts` tiene los colores, el espaciado, los radios, la sombra y la tipografía de `docs/design/tokens.json`. Si cambias uno, cambia el otro.
- `src/components/` tiene los componentes base: `Text`, `Button`, `Input`, `Card`, `Tag` y `StepBar`. Usa siempre este `Text` y no el de React Native, porque es el que aplica Nunito.
- Nunito se carga en `src/app/_layout.tsx`, y la pantalla de carga sigue visible hasta que termina.
- Reglas del design system: un solo botón primario por pantalla, nada de naranja, `butter` solo para la ⭐ y para avisos (en `Tag`, los tonos `certified` y `warning`) y Nimbus como máximo una vez por pantalla.

## Agregar dependencias

Usa `pnpm exec expo install <paquete>` en vez de `pnpm add`, porque elige la versión compatible con el SDK de Expo. Si una librería trae código nativo, la app necesita una development build (`pnpm exec expo run:android` o `run:ios`) en lugar de Expo Go.

## Comandos

| Comando          | Qué hace                            |
| ---------------- | ----------------------------------- |
| `pnpm dev`       | Inicia el servidor de Expo          |
| `pnpm lint`      | ESLint con la configuración de Expo |
| `pnpm typecheck` | Revisión de tipos                   |

ESLint está fijado en la versión 9 porque los plugins de `eslint-config-expo` todavía no son compatibles con la 10.
