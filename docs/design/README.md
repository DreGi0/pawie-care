# Diseño de la app móvil

Mockups de alta fidelidad de la app del dueño (iPhone, 390 × 844) y tokens del design system **Pawie Care**. Son la referencia visual y de textos para `apps/mobile`.

> **Los mockups son referencia, no código para copiar.** Están en HTML. La app se construye con Expo + React Native y Expo Router. Si un mockup contradice [las reglas de negocio](../reglas-de-negocio.md) o el contrato [`apps/api/openapi.json`](../../apps/api/openapi.json), mandan las reglas y el contrato.

## Contenido

| Archivo             | Qué es                                                                       |
| ------------------- | ---------------------------------------------------------------------------- |
| `tokens.json`       | Colores, tipografía (Nunito), espaciado, radios y sombra                     |
| `screens/*.dc.html` | Una pantalla por archivo. El estilo está inline y los textos son los finales |

## Pantallas y flujo

```mermaid
flowchart LR
  B[Bienvenida] --> R[Registro] --> M[OnbMascota] --> D[OnbDireccion] --> I[Main · Buscar]
  B --> L[Login] --> I
  I --> P[Perfil] --> S[Reservar] --> E[Esperando] --> G[Pagar] --> C[Confirmada]
  I --> V[Visitas]
  V --> G
  C --> V
```

| Archivo                | Pantalla                                          | Endpoints principales                                |
| ---------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| `Bienvenida.dc.html`   | Bienvenida con Nimbus "hola"                      | (ninguno)                                            |
| `Registro.dc.html`     | Crear cuenta                                      | `POST /v1/auth/register`                             |
| `Login.dc.html`        | Iniciar sesión, con estado de error               | `POST /v1/auth/login`                                |
| `OnbMascota.dc.html`   | Onboarding 1/2: registrar la mascota              | `GET /v1/catalog`, `POST /v1/pets`, `POST /v1/files` |
| `OnbDireccion.dc.html` | Onboarding 2/2: dirección                         | `POST /v1/addresses`                                 |
| `Main.dc.html`         | Pestaña Buscar: buscador y resultados             | `POST /v1/caregivers/search`                         |
| `Perfil.dc.html`       | Perfil del cuidador con galería de 3 fotos        | `GET /v1/caregivers/{id}`                            |
| `Reservar.dc.html`     | Paso 1: revisar y enviar la solicitud             | `POST /v1/bookings`                                  |
| `Esperando.dc.html`    | Paso 2: el cuidador responde (`REQUESTED`)        | `GET /v1/bookings/{id}`                              |
| `Pagar.dc.html`        | Paso 3: pagar (`PENDING_PAYMENT`)                 | `POST /v1/bookings/{id}/payments`                    |
| `Confirmada.dc.html`   | Visita confirmada (`CONFIRMED`) con Nimbus "hola" | `GET /v1/bookings/{id}`                              |
| `Visitas.dc.html`      | Pestaña Mis visitas, con estado vacío             | `GET /v1/bookings`                                   |

## Reglas del design system

- Cada pantalla tiene **un solo botón primario** (`grape-deep`).
  - Si una lista puede tener varias acciones primarias, solo la más urgente lleva el botón primario y las demás, el secundario. Por ejemplo, en Visitas, con dos reservas por pagar, solo la que vence antes muestra "Pagar" en primario.
- No se usa naranja. `butter` es solo para la ⭐ y para avisos reales.
- Los pasteles (`grape`, `sage`, `sky`) son superficies y siempre llevan texto `ink`.
- El texto más pequeño es `caption` (13 px). Las áreas táctiles miden al menos 48 px.
- Nimbus aparece como máximo una vez por pantalla, nunca en listas ni formularios.

## Cómo leer los `.dc.html`

- El bloque `<script type="text/x-dc">` es la lógica del prototipo. Muestra los estados interactivos: selección de mascotas, cálculo del precio, aceptación simulada a los 5 s.
- `{{valor}}` es un dato que llega de ese script. En la app, ese dato viene de la API o del estado.
- `<sc-if>` y `<sc-for>` son condicionales y listas.
- Los props de `data-props` (`showError`, `primeraReserva`, `sinVisitas`) activan estados alternos: error de login, primera reserva y lista vacía.

## Pendientes conocidos

- **Galería de 3 fotos:** el backend solo tiene `photoUrl`. Falta agregar `photos: [{ fileId, caption }]` (máximo 3) a `CaregiverProfile`.
- **Recuperar contraseña:** el enlace aparece en el login, pero el endpoint no existe. La app todavía no lo muestra.
- **Términos y Aviso de privacidad:** Registro los nombra como texto, sin enlace, porque esas páginas no existen.
- **Mis mascotas y Cuenta no tienen mockup**, aunque están en la barra de pestañas. En la app, Mis mascotas se hizo con el design system: una tarjeta por mascota (foto o inicial, especie, raza y edad), un estado vacío y "Agregar mascota". Cuenta solo muestra el nombre, el correo y "Cerrar sesión".
- **Perfil de la mascota:** OnbMascota dice "Agrégalo luego en su perfil", pero la app todavía no tiene la pantalla de la mascota con sus tareas de cuidado, vacunas e indicaciones del veterinario.
- **Género en la ⭐:** el mockup dice "⭐ Certificada", pero la API no dice si el cuidador es hombre o mujer. La app muestra "⭐ Con certificación".
- **Avisos:** Esperando y Confirmada dicen "Te avisamos", pero la app no tiene notificaciones push. Esperando dice que la pantalla cambia sola, porque vuelve a preguntar mientras está abierta.
- **Precio en Reservar:** antes de crear la reserva, la app estima el total con el recargo por mascota (50%) y la tarifa de servicio (10%) de §15 de las reglas, porque la API no los publica. Pagar ya muestra los montos que guardó la reserva (RN-PRE-07). Si cambian esos parámetros, hay que cambiar `src/lib/price.ts` o publicarlos en `GET /v1/catalog`.
- **Varias visitas o noches:** la búsqueda pide una sola visita o una sola noche. La API acepta varias (RN-SER-03).
- **Nombre de la dirección:** se guarda siempre como "Casa".
- **Barra de pestañas:** en la app flota sobre el borde inferior, con las esquinas redondas, en lugar de pegarse al borde como en Main y Visitas.
- **Nivel de cuidado en Mis mascotas:** no se muestra si una mascota es Normal o Especial, ni que no se puede reservar (por ejemplo, si necesita insulina). Depende de las fechas de cada servicio (RN-MAS-05) y la API solo lo calcula en la búsqueda.
- **Aviso de cuidado especial en Main:** el mockup nombra a la mascota ("Mishi necesita cuidado especial"), pero la búsqueda devuelve el `careLevel` de todas las mascotas juntas, no cuál es la especial.
- **Nimbus:** está dibujado en SVG inline. Hay que reemplazarlo por los assets finales (`nimbus-hola.svg`, `nimbus-durmiendo.svg`).
- **Fotos de cuidadores:** son marcadores `[Foto N]`.
