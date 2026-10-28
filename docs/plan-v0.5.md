# Pawie Care: plan para llegar a la v0.5

**Fecha:** 2026-10-28 · **Punto de partida:** commit `d088fba` (código según las reglas v0.4)

Este plan lleva el código de las reglas v0.4 a las [reglas v0.5](reglas-de-negocio.md). Cada etapa es un PR que deja el CI en verde. Las etapas siguen el orden de las dependencias. Las etapas 11 y 12 no dependen de las otras y se pueden adelantar.

## 1. Brecha entre el código y la v0.5

| Área                   | Hoy en el código                                                        | Falta para la v0.5                                                                                           | Etapa |
| ---------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----- |
| Precios                | Rangos por servicio y **nivel de la mascota**; tarifa 10%, comisión 15% | Rangos por **nivel del cuidador**; tarifa 15%, comisión 0%; primer servicio sin tarifa; cotización en la API | 6     |
| Niveles                | No existen                                                              | Nivel calculado, requisitos y progreso                                                                       | 6     |
| Búsqueda               | Mascota, servicio, fecha y distrito                                     | Filtros por nivel, certificaciones y calificación; nivel e insignias en los resultados                       | 6     |
| Certificaciones        | Solo la ⭐ (`CertificationType` ya es catálogo)                         | Tipos Primeros auxilios, Perros grandes y Gatos; insignias de verificación                                   | 7     |
| Ficha                  | Datos, salud, vacunas, indicaciones y tareas de cuidado                 | Alimento, horarios de comida y medicinas, premios, rutina y celo; pantalla de la mascota                     | 7     |
| Servicios              | Visita y pernocta                                                       | Paseo                                                                                                        | 8     |
| App del cuidador       | No existe; cuidadores del seed                                          | Modo cuidador, alta, verificación, curso de bienvenida, perfil, solicitudes, agenda y ganancias              | 9     |
| Aceptar o rechazar     | La máquina de estados lo permite, pero no hay endpoints                 | Endpoints y pantalla de solicitudes                                                                          | 9     |
| Ejecución              | Estados `IN_PROGRESS` a `CLOSED` sin transiciones                       | Check-in, tareas, fotos, ruta, check-out, cierre a las 48 h, pago simulado y reseñas                         | 10    |
| Avisos e integraciones | Nada                                                                    | Push, agregar al calendario y compartir perfil                                                               | 11    |
| Soporte y garantía     | Nada                                                                    | Asistente, centro de ayuda, casos, WhatsApp y reclamo de garantía                                            | 12    |

## 2. IDs de reglas que cambiaron

Al tocar el código que los cita, se actualiza el comentario.

| ID en el código      | En la v0.5                                                              |
| -------------------- | ----------------------------------------------------------------------- |
| RN-PRE-01, RN-CUI-17 | Mismo ID; el rango ahora es por **nivel del cuidador**                  |
| RN-PRE-02            | Mismo ID; ya no dice que una mascota Especial sube el precio            |
| RN-PRE-03, RN-PRE-04 | Mismo ID; 15% y 0%                                                      |
| RN-MAS-06, RN-RES-01 | Mismo ID; Especial exige la ⭐ pero no cambia el precio                 |
| RN-CUI-07            | Mismo ID; ahora es la lista de certificaciones, y la ⭐ es una de ellas |
| RN-DIS-01            | RN-GAR-02                                                               |
| RN-DIS-02            | RN-GAR-03                                                               |
| RN-FID-01            | RN-GAR-01 y RN-GAR-04                                                   |
| "§15" en comentarios | Sigue siendo §15                                                        |

## 3. Etapas

### Etapa 6: precios por nivel del cuidador

**Reglas:** RN-NIV-01 a RN-NIV-06, RN-PRE-01 a RN-PRE-04, RN-PRE-07, RN-PRE-09, RN-PRE-10, RN-RES-10, RN-CUI-21.

**API:**

- Enum `CaregiverLevel` (`NEW`, `TRUSTED`, `PRO`, `SUPER`) y columna `CaregiverProfile.level`, guardada para poder filtrar y ordenar en SQL.
- Función pura `src/caregivers/caregiver-level.ts`: recibe reseñas, promedio, servicios completados y certificaciones vigentes, y devuelve el nivel y lo que falta para el siguiente. Con su `.spec.ts`. Se llama en la misma transacción que cambie cualquiera de esos datos, y desde un script `caregivers:recalculate-levels`.
- `CaregiverServicePrice` deja de tener `careLevel`: la llave pasa a ser cuidador y servicio.
- Settings:
  - `pricing.priceRanges` por servicio y nivel del cuidador.
  - `pricing.ownerServiceFeeBp = 1500` y `pricing.caregiverCommissionBp = 0`.
  - Nuevos: `pricing.firstServiceWindowDays = 15` y `levels.requirements`.
- `Booking` guarda `caregiverLevel` y `firstServiceFeeWaived`. La tarifa en 0 queda en el snapshot (RN-PRE-07).
- Primer servicio sin tarifa: se decide al crear la reserva, con el dueño bloqueado en la transacción para que dos solicitudes a la vez no tomen el beneficio las dos.
- `POST /v1/bookings/quote`: mismo cuerpo que `POST /v1/bookings`, devuelve `BookingPrice` sin guardar nada. Usa las mismas funciones de `src/pricing/`.
- Búsqueda y perfil:
  - Filtros `minLevel`, `certificationCodes` y `minRating`.
  - Respuesta con `level`, `badges` y `certifications`.
  - `hasSpecialCareCertification` se queda, porque Especial sigue exigiendo la ⭐.
- `GET /v1/users/me` agrega `firstServiceFeeWaiverEndsAt`, que es null si ya no aplica.
- Seed: cuidadores en los cuatro niveles, con reseñas y certificaciones coherentes.

**App:**

- Main: filtros y nivel en cada resultado.
- Perfil: nivel, insignias, certificaciones y habilidades.
- Reservar: el total viene de `/quote`. Se borra `estimatePrice` de `src/lib/price.ts`.
- Pagar: la tarifa aparece tachada en $0.00 con el texto "Primer servicio".
- Aviso "Tu primer servicio sin tarifa" con los días que quedan.

**Terminado cuando:**

- Hay tests de los cuatro niveles y sus bordes, y de que un nivel puede bajar.
- El total de `/quote` es igual al de la reserva creada.
- El beneficio no se duplica con dos reservas activas, y vuelve a estar disponible si la primera vence.
- El ejemplo de RN-PRE (cuidador Confiable a $6.50: el dueño paga $7.48 y el cuidador recibe $6.50) es un test.

### Etapa 7: ficha ampliada y certificaciones

**Reglas:** RN-MAS-02, RN-MAS-11, RN-CUI-05 a RN-CUI-11, RN-CUI-19, RN-CUI-21.

**API:**

- `Pet` agrega `foodDescription`, `foodPortion`, `allowedTreats`, `dailyRoutine`, `heatStartsOn` y `heatEndsOn` (`date`).
- `PetScheduleItem` con `petId`, `kind` (`MEAL` o `MEDICATION`), `minuteOfDay`, `label` y `dose?`. Sirve para la ficha y para las tareas del tramo de la etapa 10.
- Seed de `CertificationType`: `SPECIAL_CARE` (la ⭐), `FIRST_AID`, `LARGE_DOGS` y `CATS`.
- Habilidades declaradas: enum `CaregiverSkill[]` en `CaregiverProfile`.
- Insignias en las respuestas, derivadas de datos que ya existen:
  - `IDENTITY_VERIFIED` y `BACKGROUND_CHECKED` salen del estado aprobado.
  - `VET_STUDENT` sale de `vetStudentUntil`.

**App:** pantalla **Perfil de la mascota**, que ya estaba pendiente en `docs/design/README.md`. Muestra y edita la ficha: rutina, horarios, salud, tareas de cuidado e indicaciones, y el celo.

**Terminado cuando:**

- Un horario de comida a las 7:00 aparece en la ficha.
- Una mascota en celo no cambia su `careLevel`.
- Las insignias salen en la búsqueda y en el perfil.

### Etapa 8: servicio de paseo

**Reglas:** RN-SER-05, RN-RES-01, RN-RES-03.

**API:**

- `ServiceCode.WALK`, con los settings `services.walkDurationMinutes = 45` y `bookings.maxDogsPerWalk = 2`.
- `CreateBookingRequest.walks?: string[]`, con el inicio de cada paseo.
- El plan de tramos (`slot-plan.ts`) y la disponibilidad tratan el paseo como un tramo de 45 min.
- Si se elige un gato o más de 2 perros, la API responde 422 con un `errorCode` propio.

**App:** el paseo en la búsqueda y en Reservar. Al elegir paseo, solo se pueden elegir perros.

**Terminado cuando:**

- Hay tests del plan de tramos para el paseo.
- Hay un test de la exclusión entre un paseo y una visita del mismo cuidador.
- Hay un test de que no se puede reservar un paseo para un gato.

### Etapa 9: app del cuidador, parte 1

**Antes de programar:** los mockups de las pantallas del cuidador en `docs/design/screens/`, con la lista de `docs/design/README.md`.

**Reglas:** RN-CTA-06, RN-CUI-01 a RN-CUI-04, RN-CUI-16 a RN-CUI-20, RN-NIV-05, RN-RES-11, RN-PAG-10.

**API:**

- **Modo cuidador:** `POST /v1/caregivers/me` crea el perfil en `PENDING_APPROVAL`. `GET` y `PATCH /v1/caregivers/me` manejan perfil, habilidades, distritos, horario, precios, Reserva inmediata y pausa.
- **Documentos:** `FilePurpose` agrega `ID_DOCUMENT`, `SELFIE` y `BACKGROUND_CHECK`. Solo los ven el dueño del archivo y los administradores.
- **Curso de bienvenida:**
  - `GET /v1/courses/welcome` devuelve módulos y preguntas, sin las respuestas.
  - `POST /v1/courses/welcome/attempts` califica en la API y guarda el intento.
  - El contenido viene del seed.
- **Aprobación:** el script `caregivers:approve <email>` aprueba el perfil y marca las insignias.
- **Solicitudes:**
  - `GET /v1/caregivers/me/bookings?status=` lista las reservas del cuidador.
  - `POST /v1/bookings/:id/accept` y `POST /v1/bookings/:id/reject` usan las transiciones que ya existen en `booking-status.ts`.
  - La respuesta muestra la dirección exacta solo si la reserva está `CONFIRMED` o en un estado posterior (RN-CTA-04).
- **Progreso:** `GET /v1/caregivers/me/level` devuelve el nivel y lo que le falta, con la función de la etapa 6.
- **Ganancias:** `GET /v1/caregivers/me/earnings` devuelve lo que tiene por cobrar, lo pagado y el total del mes.

**App:**

- Activar el modo cuidador desde Cuenta.
- Pestañas propias del cuidador: Inicio, Agenda, Ganancias y Cuenta.
- Alta: documentos y curso.
- Inicio: nivel y progreso, y solicitudes pendientes.
- Detalle de la solicitud: aceptar o rechazar.
- Agenda.
- Editar el perfil y los precios, con el rango y el sugerido.
- Ganancias.

**Terminado cuando:**

- Una cuenta de dueño activa el modo cuidador, se aprueba con el script, aparece en la búsqueda y acepta una solicitud hecha desde otro emulador.
- Un precio fuera del rango responde 422.

### Etapa 10: ejecución del servicio y reseñas

**Reglas:** §11, RN-PAG-03, RN-RSE-01, RN-RSE-06.

**API:**

- **Check-in y check-out:** `POST /v1/bookings/:id/slots/:slotId/check-in` y `/check-out`, con hora y ubicación.
  - El primer check-in pasa la reserva a `IN_PROGRESS`, y el check-out del último tramo, a `COMPLETED`.
  - El check-out exige las fotos mínimas.
- **Fotos:** `FilePurpose.CARE_LOG_PHOTO`, en `POST /v1/bookings/:id/slots/:slotId/photos`.
- **Tareas del tramo:** `GET /v1/bookings/:id/slots/:slotId/tasks` arma la lista con `PetScheduleItem` y las tareas de cuidado activas. `POST …/tasks/:taskKey/done` marca una tarea como hecha.
- **Ruta:** `POST /v1/bookings/:id/slots/:slotId/route` recibe lotes de puntos `{ lat, lng, recordedAt }`, y `GET …/route` los devuelve. Cada punto se guarda como una fila de `RoutePoint`.
- **Colas:**
  - Una tarea diferida avisa si no hay check-in a los [30 min].
  - Otra pasa la reserva a `CLOSED` a las [48 h] del check-out si no está `DISPUTED`, y crea un `Payout` con estado `SIMULATED`.
- **Reseñas:** `POST /v1/bookings/:id/review`. En la misma transacción actualiza `ratingSum` y `ratingCount` y recalcula el nivel.

**App:**

- **Cuidador, Servicio en curso:**
  - La ficha y las tareas.
  - Fotos con la cámara, usando `expo-image-picker`, que ya está instalado.
  - La ruta con `expo-location` en primer plano: un punto cada [15 s] y un envío cada [30 s].
- **Dueño, Seguimiento:**
  - Estado, fotos y tareas.
  - En un paseo, un mapa con `react-native-maps` que vuelve a pedir la ruta cada [10 s] con `refetchInterval`.
- **Dueño, Calificar:** al terminar el servicio.

**Terminado cuando:**

- Hay tests de las transiciones `CONFIRMED → IN_PROGRESS → COMPLETED → CLOSED`.
- No se puede hacer check-out sin foto.
- Una reseña cambia el nivel cuando cruza un umbral.
- El dueño ve la ruta mientras el cuidador camina en el emulador, con una ubicación simulada.

### Etapa 11: notificaciones, calendario y compartir

**Reglas:** RN-NOT-01 a RN-NOT-03, RN-CAL-01, RN-CUI-22.

**API:**

- Modelo `PushToken` y `POST /v1/users/me/push-tokens`.
- Módulo `notifications`, que envía con la API HTTP del Expo Push Service usando el `fetch` de Node, sin SDK.
- Los eventos de RN-NOT-01 y RN-NOT-02 salen de los mismos servicios que cambian el estado. El envío va por BullMQ para no frenar la petición.

**App:**

- Notificaciones con `expo-notifications`, que necesita una development build.
- "Agregar al calendario" con `expo-calendar`.
- "Compartir perfil" con `Share` de React Native.

**Terminado cuando:**

- Aceptar una solicitud le llega como push al dueño en el emulador.
- Si el usuario niega el permiso, nada falla.

### Etapa 12: soporte, asistente y garantía

**Reglas:** §14 y §17.

**API:**

- **Módulo `support`:**
  - `HelpNode` con `parentId`, `audience` (`OWNER` o `CAREGIVER`), `label`, `answer`, `action` (`NONE`, `WHATSAPP`, `CREATE_CASE` o `VET_EMERGENCY`) y `sortOrder`.
  - `SupportCase` con un número correlativo, usuario, `bookingId?`, `type`, `path` (las opciones que recorrió) y `status`.
- **Endpoints:**
  - `GET /v1/help?audience=` devuelve el árbol completo, que es corto y se guarda en caché.
  - `POST /v1/support/cases` responde con `{ caseNumber, whatsappUrl | null, withinHours }`.
- **Horario:** la API decide si es dentro o fuera de horario con `support.hours`, en `America/El_Salvador`. Fuera de horario envía un correo al equipo (Mailpit en local, Resend en la demo).
- **WhatsApp:** `whatsappUrl` es `https://wa.me/<número>?text=Caso%20<n>`, y el número va en el setting `support.whatsappNumber`.
- **Garantía:**
  - `POST /v1/bookings/:id/claims` crea un caso `GUARANTEE_CLAIM` y pasa la reserva a `DISPUTED` si está dentro del plazo.
  - El script `claims:resolve <case> approve|reject` la pasa a `CLOSED` o deja el pago en `REFUND_PENDING`.
- **Contenido:** el seed carga el árbol inicial de dueño y de cuidador.

**App:**

- Pantalla `ayuda` que muestra el árbol como burbujas, con Nimbus una sola vez.
- Abre WhatsApp con `Linking.openURL`.
- Acceso desde Cuenta, desde el detalle de la reserva ("Tengo un problema") y desde el centro de ayuda.

**Terminado cuando:**

- Hay tests de dentro y fuera de horario con un reloj fijo.
- Un reclamo fuera de plazo responde 422.
- Un reclamo congela el cierre de la etapa 10.
- El nodo de emergencia muestra el teléfono del veterinario de la ficha.

## 4. Decisiones abiertas

Las que bloquean una etapa están marcadas.

| Decisión                              | Etapa                               | Valor provisional                      |
| ------------------------------------- | ----------------------------------- | -------------------------------------- |
| Rangos de visita y pernocta por nivel | 6                                   | Los de RN-PRE-01                       |
| Umbrales de los niveles               | 6                                   | Los de RN-NIV-02                       |
| Documentos exactos de antecedentes    | 9                                   | DUI, selfie y antecedentes o solvencia |
| Contenido del curso de bienvenida     | 9 (**bloquea**)                     | Ninguno: lo escribe el equipo          |
| Número de WhatsApp Business           | 12                                  | Un número de prueba en el seed         |
| Contenido del asistente               | 12 (**bloquea**)                    | Ninguno: lo escribe el equipo          |
| URL para compartir el perfil          | 11                                  | `https://pawieapp.com`                 |
| Clave de Google Maps para Android     | 10 (**bloquea** el mapa en Android) | Ninguno                                |
