# @pawie/api-client

Cliente de la API de Pawie Care para las apps: la móvil (Expo) y, más adelante, la web. [Orval](https://orval.dev) lo genera desde el contrato [apps/api/openapi.json](../../apps/api/openapi.json) (arquitectura §3.4). Trae:

- los **tipos** de cada petición y respuesta;
- una **función por operación**, que usa `fetch`;
- un **hook de TanStack Query** por operación: `useQuery` para las lecturas y `useMutation` para lo que cambia algo;
- los **esquemas Zod** de los parámetros, los cuerpos y las respuestas, en `@pawie/api-client/zod`.

## Cómo se genera

Todo lo de `src/generated/` lo escribe Orval, así que **nadie lo edita a mano**. Si la API cambia:

```bash
pnpm --filter @pawie/api openapi:generate     # 1. el contrato
pnpm --filter @pawie/api-client generate      # 2. el cliente
```

Haz commit de los dos. El código generado va en git, como `openapi.json`, para que un cambio del contrato se vea en el diff del PR y para que la app lo use sin generar nada antes. Turborepo lo vuelve a generar antes de `typecheck` y `test`, y el CI falla si quedó distinto de lo que está en git.

La configuración está en [orval.config.ts](orval.config.ts). Lo único escrito a mano es [src/fetcher.ts](src/fetcher.ts), por el que pasan todas las llamadas.

## Uso

Al arrancar, la app dice dónde está la API y cómo conseguir el token de acceso:

```ts
import { configureApiClient } from '@pawie/api-client';

configureApiClient({
  // Emulador de Android: la computadora es 10.0.2.2. Simulador de iOS: localhost.
  baseUrl: 'http://10.0.2.2:3000',
  getAccessToken: () => session.accessToken,
});
```

Después, los hooks funcionan dentro de un `QueryClientProvider`:

```tsx
import { useBookingsGet, usePaymentsStart } from '@pawie/api-client';

const booking = useBookingsGet(bookingId);
const pay = usePaymentsStart();
pay.mutate({ bookingId });
```

Cada hook lleva el nombre del `operationId` de la API: `Bookings_get` es `useBookingsGet()` y la función `bookingsGet()`.

- **Búsqueda de cuidadores:** `POST /v1/caregivers/search` no cambia nada, así que es una query y no una mutación: `useCaregiversSearch(body)` la guarda en caché por su cuerpo.
- **Errores:** cuando la API responde con un error, la función lanza un `ApiError` y TanStack Query lo entrega como `error`. Trae `status`, `errorCode` y `body`, con la forma `{ statusCode, errorCode, message, details? }`. Decide qué hacer según `errorCode`; `message` está en español para mostrárselo al usuario. Con `UNAUTHORIZED`, la app tiene que renovar el token.
- **Formularios:** los esquemas Zod sirven con React Hook Form. Por ejemplo, `BookingsCreateBody` de `@pawie/api-client/zod` valida el cuerpo de una reserva con los mismos límites que la API.

## Pagos

El flujo del pago (reglas RN-PAG, arquitectura §6):

1. `usePaymentsStart()` devuelve el pago con su `checkoutUrl`, la página de Wompi.
2. La app la abre con `WebBrowser.openAuthSessionAsync(checkoutUrl, 'pawie://payment/result')`, de expo-web-browser.
3. Después de pagar, Wompi devuelve al dueño a la app por `pawie://payment/result?bookingId=…&paymentId=…`.
4. La reserva se confirma cuando llega el webhook de Wompi, no cuando el dueño vuelve. Hasta entonces, `useBookingsGet()` muestra la reserva en `PENDING_PAYMENT` y su `payment` en `PENDING`, así que la app vuelve a consultarla hasta que esté `CONFIRMED`.
   - Si el pago queda en `REFUND_PENDING`, Wompi cobró, pero la reserva no se pudo confirmar, y el dinero se devuelve.

## Comandos

| Comando          | Qué hace                                    |
| ---------------- | ------------------------------------------- |
| `pnpm generate`  | Vuelve a generar `src/generated/` con Orval |
| `pnpm typecheck` | Revisión de tipos                           |
| `pnpm test`      | Pruebas de `src/fetcher.ts`                 |
