# @pawie/mobile

App móvil de Pawie Care para iOS y Android, hecha con Expo SDK 58 y Expo Router. Las pantallas viven en `src/app/`: cada archivo es una ruta.

## Correr la app en Android

Para probarla con la API y los datos locales, sigue primero la preparación de Docker, `.env`, migraciones y seed de [las instrucciones de la raíz](../../README.md#primeros-pasos). Inicia el emulador de Android Studio antes de continuar.

En una terminal desde la raíz del repo, deja la API corriendo:

```bash
pnpm --filter @pawie/api dev
```

Comprueba en otra terminal que PostgreSQL y Redis estén conectados:

```powershell
Invoke-RestMethod http://localhost:3000/v1/health
```

La respuesta debe indicar `status: ok` y `up` para `database` y `redis`. Con la API arriba, abre otra terminal en la raíz del repo y ejecuta:

```bash
pnpm --filter @pawie/mobile android
```

Para limpiar la caché de Metro si hay problemas con el bundle:

```bash
pnpm --filter @pawie/mobile android -- --clear
```

También puedes ejecutar `pnpm android` desde esta carpeta. El emulador Android accede al backend del equipo por `http://10.0.2.2:3000`; no uses `localhost` como URL de la API desde la app.

## Correr la app en el simulador de iPhone (macOS)

Necesitas Xcode instalado y abierto al menos una vez para que configure sus componentes. Abre **Simulator** desde Xcode (`Xcode > Open Developer Tool > Simulator`) y selecciona un iPhone en `File > Open Simulator`. También puedes dejar que Expo abra el simulador disponible.

La infraestructura local y la API deben estar corriendo. Desde la raíz del repo, deja la API activa en una terminal:

```bash
pnpm --filter @pawie/api dev
```

En otra terminal, verifica que la API, PostgreSQL y Redis respondan:

```bash
curl http://localhost:3000/v1/health
```

La respuesta debe incluir `"status":"ok"` y `"up"` para `database` y `redis`. Luego, desde la raíz, inicia la app en el simulador:

```bash
pnpm --filter @pawie/mobile ios
```

Si necesitas limpiar la caché de Metro:

```bash
pnpm --filter @pawie/mobile ios -- --clear
```

También puedes ejecutar `pnpm ios` desde esta carpeta. El simulador de iOS accede a la API local por `http://localhost:3000`.

## Conectarse a la API

La app usa la API local:

- **Emulador de Android:** la API está en `http://10.0.2.2:3000`.
- **Simulador de iOS:** la API está en `http://localhost:3000`.

Para usar otra, como la de la demo desplegada, pon `EXPO_PUBLIC_API_URL=https://…` en `apps/mobile/.env.local` y reinicia Expo.

Para que las fotos carguen en el emulador Android, configura `S3_PUBLIC_ENDPOINT=http://10.0.2.2:8333` en `apps/api/.env` y reinicia la API. En el simulador iOS, el valor predeterminado `http://localhost:8333` funciona sin cambios.

Para entrar, usa el dueño de demo del seed: `demo@example.com`, con la contraseña de `DEMO_OWNER_PASSWORD` (en local, `pawie-demo-local`). Tiene tres mascotas: Toby, Nala y Rocky.

- **Sesión:** está en `src/lib/session.ts`. El refresh token se guarda en `expo-secure-store`, así que la sesión sigue al cerrar la app. Una cuenta nueva pasa primero por el onboarding (mascota y dirección).
- **Datos:** los hooks de `@pawie/api-client` funcionan dentro del `QueryClientProvider` de `src/app/_layout.tsx`. La configuración está en `src/lib/api.ts`.
- **Búsqueda:** `src/lib/search.ts` guarda lo que se busca (mascotas, servicio, día, hora y distrito). Buscar lo cambia, y Perfil y Reservar lo leen; los resultados se comparten por la caché de TanStack Query.
- **Fechas:** se muestran y se envían en la hora de San Salvador con `src/lib/format.ts`, sin importar la zona del teléfono.

## Pantallas

| Ruta                                         | Pantalla                                                 |
| -------------------------------------------- | -------------------------------------------------------- |
| `bienvenida`, `login`, `registro`            | Sin sesión                                               |
| `onboarding/mascota`, `onboarding/direccion` | Solo para una cuenta nueva, justo después del registro   |
| `(tabs)/index`                               | Buscar: mascotas, servicio, fecha, distrito y resultados |
| `(tabs)/visitas`                             | Mis visitas: próximas y pasadas                          |
| `(tabs)/mascotas`, `(tabs)/cuenta`           | Mis mascotas y Cuenta (sin mockup)                       |
| `cuidadores/[id]`                            | Perfil del cuidador                                      |
| `reservar`                                   | Paso 1: revisar y enviar la solicitud                    |
| `reservas/[id]`                              | Pasos 2 y 3 y la visita: esperando, pagar y confirmada   |
| `payment/result`                             | Vuelta desde Wompi (`pawie://payment/result`)            |
| `mascotas/nueva`, `direcciones/nueva`        | Agregar una mascota o una dirección                      |

`reservas/[id]` cambia según el estado de la reserva y vuelve a preguntar cada 5 segundos mientras espera al cuidador o la confirmación de Wompi.

Para probar el pago hace falta configurar Wompi en la API. Sin eso, "Pagar" muestra el error `PAYMENTS_UNAVAILABLE`.

## Diseño

Las pantallas siguen los mockups y el design system de [docs/design](../../docs/design/README.md).

- `src/theme/tokens.ts` tiene los colores, el espaciado, los radios, la sombra y la tipografía de `docs/design/tokens.json`. Si cambias uno, cambia el otro.
- `src/components/` tiene los componentes:
  - `Text`, `Button`, `Input`, `Card`, `Tag` y `StepBar`;
  - `Icon`, `IconButton`, `Banner`, `Chip`, `Avatar` y `TabBar`;
  - `Touchable`, `Checkbox`, `Select`, `Sheet`, `BottomBar` y `Nimbus`;
  - `FormScreen`, `PetForm` y `AddressForm`, que comparten el onboarding y "Agregar".

  Todo lo que se toca usa `Touchable`, que se encoge un poco al presionarlo.

  Usa siempre este `Text` y no el de React Native, porque es el que aplica Nunito. En desarrollo, todos se ven en la ruta `/catalogo`, con un enlace desde Cuenta.

- **Íconos:** son de Lucide, y salen de los datos de Iconify. Para agregar uno, pon su nombre (lo encuentras en [icon-sets.iconify.design/lucide](https://icon-sets.iconify.design/lucide/)) en la lista de `scripts/generate-icons.mjs` y corre `pnpm icons`.
- Nunito se carga en `src/app/_layout.tsx`, y la pantalla de carga sigue visible hasta que termina.
- **Animaciones:** con Reanimated 4. Las de estado (presionar, la pestaña activa, la casilla) son transiciones CSS (`css.create` con `transitionProperty`), y las de entrada (listas, hojas, avisos) usan `entering`. Nimbus flota o respira con `css.keyframes`.
- **Barra de pestañas:** flota sobre el borde inferior, con las esquinas redondas, y una píldora crece detrás del ícono de la pestaña activa. Es un cambio respecto al mockup, que la pega al borde. Sus radios son la mitad de cada alto, en lugar de `radius.pill`.
- Reglas del design system: un solo botón primario por pantalla, nada de naranja, `butter` solo para la ⭐ y para avisos (en `Tag`, los tonos `certified` y `warning`) y Nimbus como máximo una vez por pantalla.

## Agregar dependencias

Usa `pnpm exec expo install <paquete>` en vez de `pnpm add`, porque elige la versión compatible con el SDK de Expo. Si una librería trae código nativo, la app necesita una development build (`pnpm exec expo run:android` o `run:ios`) en lugar de Expo Go.

## Comandos

| Comando          | Qué hace                                                                           |
| ---------------- | ---------------------------------------------------------------------------------- |
| `pnpm dev`       | Inicia el servidor de Expo                                                         |
| `pnpm lint`      | ESLint con la configuración de Expo                                                |
| `pnpm typecheck` | Revisión de tipos                                                                  |
| `pnpm test`      | Pruebas de `src/lib` (fechas, teléfonos y precios) con `node --test`               |
| `pnpm icons`     | Genera `src/components/icons.generated.ts` con los íconos de Lucide que usa la app |

ESLint está fijado en la versión 9 porque los plugins de `eslint-config-expo` todavía no son compatibles con la 10.
