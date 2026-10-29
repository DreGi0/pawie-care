# Pawie Care: plan para llegar a la v0.5

**Fecha:** 2026-10-28 · **Punto de partida:** commit `d088fba` (código según las reglas v0.4)

Este plan lleva el código de las reglas v0.4 a las [reglas v0.5](reglas-de-negocio.md). Cada etapa es un PR que deja el CI en verde.

**Dependencias:**

- Orden: 6 → 7 y 8 → 9 → base de la 11 → 10 → eventos de la 11 → 12b. Las etapas 7 y 8 no dependen entre sí, pero las dos van antes de la 10: la ruta del paseo necesita el paseo (8) y las tareas del tramo necesitan `PetScheduleItem` (7).
- **12a** (asistente, centro de ayuda y casos) es independiente de la cadena y se puede adelantar. Solo reutiliza el correo al equipo de la base de la 11, que no depende de nada. **12b** (garantía) depende de la 10 y de la 12a, porque el reclamo crea un caso de soporte.
- La **base de la 11** (modelo `PushToken`, endpoint, envío por BullMQ y correo al equipo) es independiente y se puede hacer en cualquier momento, pero la 10 la necesita. Los eventos de RN-NOT se conectan como indica la etapa 11. Lo que usa la app (permisos, calendario y compartir) va con las pantallas que lo muestran.

## 1. Brecha entre el código y la v0.5

| Área                   | Hoy en el código                                                        | Falta para la v0.5                                                                                           | Etapa |
| ---------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----- |
| Precios                | Rangos por servicio y **nivel de la mascota**; tarifa 10%, comisión 15% | Rangos por **nivel del cuidador**; tarifa 15%, comisión 0%; primer servicio sin tarifa; cotización en la API | 6     |
| Niveles                | No existen                                                              | Nivel calculado, requisitos y progreso                                                                       | 6     |
| Búsqueda               | Mascota, servicio, fecha y distrito                                     | Filtros por nivel, certificaciones y calificación; nivel e insignias en los resultados                       | 6     |
| Certificaciones        | Solo la ⭐ (`CertificationType` ya es catálogo)                         | Tipos Primeros auxilios, Perros grandes y Gatos; insignias de verificación; habilidades declaradas           | 6     |
| Ficha                  | Datos, salud, vacunas, indicaciones y tareas de cuidado                 | Alimento, horarios de comida y medicinas, premios, rutina y celo; pantalla de la mascota                     | 7     |
| Servicios              | Visita y pernocta                                                       | Paseo                                                                                                        | 8     |
| App del cuidador       | No existe; cuidadores del seed                                          | Modo cuidador, alta, verificación, curso de bienvenida, perfil, solicitudes, agenda y ganancias              | 9     |
| Aceptar o rechazar     | La máquina de estados lo permite, pero no hay endpoints                 | Endpoints y pantalla de solicitudes                                                                          | 9     |
| Ejecución              | Estados `IN_PROGRESS` a `CLOSED` sin transiciones                       | Check-in, tareas, fotos, ruta, check-out, cierre a las 48 h, pago simulado y reseñas                         | 10    |
| Avisos e integraciones | Nada                                                                    | Push (base, y eventos en las etapas 9 y 10), agregar al calendario y compartir perfil                        | 11    |
| Soporte                | Nada                                                                    | Asistente, centro de ayuda, casos y WhatsApp                                                                 | 12a   |
| Garantía               | Nada                                                                    | Reclamo, estado `DISPUTED` y resolución                                                                      | 12b   |

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

### Settings que cambian

Regla general: **no se renombra una clave si su significado no cambió**. Solo cambian la regla que cita.

| Clave actual                                       | En la v0.5                                                                                                                                            | Etapa |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `certifications.specialCareMinExamScoreBp`         | `certifications.minExamScoreBp`, para todas las certificaciones (RN-CUI-08)                                                                           | 6     |
| `certifications.specialCareValidityMonths`         | `certifications.validityMonths`, para todas las certificaciones (RN-CUI-09)                                                                           | 6     |
| `certifications.specialCareMinAverageRatingTenths` | Sin cambio: sigue siendo solo de la ⭐ (RN-CUI-10)                                                                                                    | —     |
| `disputes.resolutionBusinessDays`                  | `guarantee.resolutionBusinessDays` (RN-GAR-03). Cambia el significado, porque ahora es el plazo de la garantía                                        | 12b   |
| `payments.payoutHoldMinutes`                       | **No se renombra.** Sigue en minutos, porque el registry guarda los plazos así. Solo cambia la regla que cita: de `RN-DIS-01` a RN-PAG-03 y RN-GAR-02 | 10    |

## 3. Etapas

### Etapa 6: precios por nivel del cuidador

**Avance:** se hace en dos PR. **6.1 (hecha, solo API):** `CaregiverLevel` y `CaregiverProfile.level`, `CaregiverSkill`, tipos de certificación, settings `certifications.minExamScoreBp`, `certifications.validityMonths` y `levels.requirements`, `caregiver-level.ts`, recálculo en la transacción (`recalculateLevel`), el script `caregivers:recalculate-levels` y el seed con los cuatro niveles. **6.2:** se parte en API y app. **API (hecha):** precios por nivel del cuidador (`CaregiverServicePrice` sin `careLevel`, `pricing.priceRanges` de visita y pernocta), tarifa 15% y comisión 0%, `pricing.firstServiceWindowDays`, `Booking.caregiverLevel` y `firstServiceFeeWaived` (con el dueño bloqueado en la transacción), `POST /v1/bookings/quote`, `firstServiceFeeWaiverEndsAt` en `GET /v1/users/me`, y los filtros `minLevel`, `certificationCodes` y `minRating` con `level`, `badges`, `certifications` y `skills` en búsqueda y perfil. **App (hecha):** filtros y nivel en Main, perfil con nivel, insignias, certificaciones y habilidades, el total de Reservar y la línea de Pagar desde `/quote` y la reserva (se borró `estimatePrice`), la tarifa tachada en $0.00 con "Primer servicio" y el aviso con los días que quedan. Para que Reservar pueda cotizar antes de que el dueño llene el contacto de emergencia, `/quote` dejó de pedir `emergency`, que no cambia el precio. **La etapa 6 está hecha.**

**Reglas:** RN-NIV-01 a RN-NIV-06, RN-PRE-01 a RN-PRE-04, RN-PRE-07, RN-PRE-09, RN-PRE-10, RN-RES-10, RN-CUI-05 a RN-CUI-07, RN-CUI-09, RN-CUI-11, RN-CUI-19, RN-CUI-21.

**API:**

- Enum `CaregiverLevel` (`NEW`, `TRUSTED`, `PRO`, `SUPER`) y columna `CaregiverProfile.level`, guardada para poder filtrar y ordenar en SQL.
- Función pura `src/caregivers/caregiver-level.ts`: recibe reseñas, promedio, servicios completados y certificaciones vigentes, y devuelve el nivel y lo que falta para el siguiente. Con su `.spec.ts`. Se llama en la misma transacción que cambie cualquiera de esos datos, y desde un script `caregivers:recalculate-levels`.
- `CaregiverServicePrice` deja de tener `careLevel`: la llave pasa a ser cuidador y servicio.
- Settings:
  - `pricing.priceRanges` por servicio y nivel del cuidador. Solo visita y pernocta: el paseo suma su rango en la etapa 8.
  - `certifications.minExamScoreBp` y `certifications.validityMonths` reemplazan a las claves `specialCare*` (ver §2).
  - `pricing.ownerServiceFeeBp = 1500` y `pricing.caregiverCommissionBp = 0`.
  - Nuevos: `pricing.firstServiceWindowDays = 15` y `levels.requirements`.
- `Booking` guarda `caregiverLevel` y `firstServiceFeeWaived`. La tarifa en 0 queda en el snapshot (RN-PRE-07).
- Primer servicio sin tarifa: se decide al crear la reserva, con el dueño bloqueado en la transacción para que dos solicitudes a la vez no tomen el beneficio las dos.
- `POST /v1/bookings/quote`: mismo cuerpo que `POST /v1/bookings`, menos `emergency`, que no cambia el precio. Devuelve `BookingPrice` sin guardar nada. Usa las mismas funciones de `src/pricing/`.
- Búsqueda y perfil:
  - Filtros `minLevel`, `certificationCodes` y `minRating`.
  - Respuesta con `level`, `badges` y `certifications`.
  - `hasSpecialCareCertification` se queda, porque Especial sigue exigiendo la ⭐.
- `GET /v1/users/me` agrega `firstServiceFeeWaiverEndsAt`, que es null si ya no aplica.
- **Certificaciones, insignias y habilidades:**
  - Seed de `CertificationType`: `SPECIAL_CARE` (la ⭐), `FIRST_AID`, `LARGE_DOGS` y `CATS`.
  - Enum `CaregiverSkill[]` en `CaregiverProfile` (habilidades declaradas, RN-CUI-19).
  - Insignias en las respuestas, derivadas de datos que ya existen: `IDENTITY_VERIFIED` y `BACKGROUND_CHECKED` salen del estado aprobado, y `VET_STUDENT` sale de `vetStudentUntil`.
- Servicios completados: `completedBookingCount`, `ratingSum` y `ratingCount` ya existen en `CaregiverProfile`. El seed los llena coherentes con cada nivel (RN-NIV-02); la etapa 10 incrementa `completedBookingCount` en el check-out final.
- Seed: cuidadores en los cuatro niveles, con reseñas y certificaciones coherentes.

**App:**

- Main: filtros y nivel en cada resultado.
- Perfil: nivel, insignias, certificaciones y habilidades declaradas, en ese orden.
- Reservar: el total viene de `/quote`. Se borra `estimatePrice` de `src/lib/price.ts`.
- Pagar: la tarifa aparece tachada en $0.00 con el texto "Primer servicio".
- Aviso "Tu primer servicio sin tarifa" con los días que quedan.

**Terminado cuando:**

- Hay tests de los cuatro niveles y sus bordes, y de que un nivel puede bajar.
- El total de `/quote` es igual al de la reserva creada.
- El beneficio no se duplica con dos reservas activas, y vuelve a estar disponible si la primera vence.
- El ejemplo de RN-PRE (cuidador Confiable a $6.50: el dueño paga $7.48 y el cuidador recibe $6.50) es un test de las funciones de `src/pricing/` con el precio en centavos. Como el paseo llega en la etapa 8, el test no usa el servicio.
- Las insignias y las certificaciones salen en la búsqueda y en el perfil.

### Etapa 7: ficha ampliada y certificaciones

**Reglas:** RN-MAS-02, RN-MAS-11.

**API:**

- `Pet` agrega `foodDescription`, `foodPortion`, `allowedTreats`, `dailyRoutine`, `heatStartsOn` y `heatEndsOn` (`date`).
- `PetScheduleItem` con `petId`, `kind` (`MEAL` o `MEDICATION`), `minuteOfDay`, `label` y `dose?`. Sirve para la ficha y para las tareas del tramo de la etapa 10.

**App:** pantalla **Perfil de la mascota**, que ya estaba pendiente en `docs/design/README.md`. Muestra y edita la ficha: rutina, horarios, salud, tareas de cuidado e indicaciones, y el celo.

**Terminado cuando:**

- Un horario de comida a las 7:00 aparece en la ficha.
- Una mascota en celo no cambia su `careLevel`.

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
  - Los eventos push de esta etapa se conectan en el paso "eventos de la 11", después de la 10.
  - Desde esta etapa la búsqueda exige el curso de bienvenida aprobado (RN-CUI-03). Antes, solo exige perfil aprobado y activo.
- **Seed:** los cuidadores de prueba quedan con el curso de bienvenida aprobado, o dejarían de salir en las búsquedas (RN-CUI-03).
- **Progreso:** `GET /v1/caregivers/me/level` devuelve el nivel y lo que le falta, con la función de la etapa 6.
- **Ganancias:** `GET /v1/caregivers/me/earnings` devuelve lo que tiene por cobrar, lo pagado y el total del mes. Hasta la etapa 10 no existe `Payout`, así que "pagado" es 0 y "por cobrar" sale de las reservas `CONFIRMED`; la etapa 10 completa el resto.

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
  - El check-out exige las fotos mínimas. El del último tramo incrementa `completedBookingCount` del cuidador y recalcula su nivel.
- **Fotos:** `FilePurpose.CARE_LOG_PHOTO`, en `POST /v1/bookings/:id/slots/:slotId/photos`.
- **Tareas del tramo:** `GET /v1/bookings/:id/slots/:slotId/tasks` arma la lista con `PetScheduleItem` y las tareas de cuidado activas. `POST …/tasks/:taskKey/done` marca una tarea como hecha.
- **Ruta:** `POST /v1/bookings/:id/slots/:slotId/route` recibe lotes de puntos `{ lat, lng, recordedAt }`, y `GET …/route` los devuelve. Cada punto se guarda como una fila de `RoutePoint`.
- **Colas:**
  - Una tarea diferida avisa si no hay check-in a los [30 min] (RN-EJE-02), por push al dueño (base de la etapa 11) y por correo al equipo.
  - Otra pasa la reserva a `CLOSED` a las [48 h] del check-out si no está `DISPUTED`, crea un `Payout` con estado `SIMULATED`. La espera sale de `payments.payoutHoldMinutes`.
- Conecta los eventos push de esta etapa con la base de la 11.
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

**Base, sin dependencias** (se puede hacer en cualquier momento; la 10 y la 12a la reutilizan):

- Modelo `PushToken` y `POST /v1/users/me/push-tokens`.
- Módulo `notifications`, que envía con la API HTTP del Expo Push Service usando el `fetch` de Node, sin SDK. El envío va por BullMQ para no frenar la petición.
- App: pedir el permiso y registrar el token con `expo-notifications`, que necesita una development build. Si el usuario niega el permiso, nada falla (RN-NOT-03).
- **Correo al equipo** en el mismo módulo `notifications` (arquitectura §5): Mailpit en local y Resend en la demo. Lo usan la 12a (casos fuera de horario) y RN-EJE-02 (etapa 10). No se crea otro mecanismo de correo.

**Eventos de RN-NOT-01 y RN-NOT-02**, llamando al módulo `notifications` desde el servicio que cambia el estado. Los de la etapa 9 se conectan en el paso "eventos de la 11", después de la 10, porque la base aún no existía. Los de la 10 y la 12b se conectan en su propia etapa:

| Evento                                                    | Etapa |
| --------------------------------------------------------- | ----- |
| Solicitud nueva, aceptada o rechazada; reserva confirmada | 9     |
| Reserva cancelada por el dueño                            | 9     |
| Check-in, foto nueva y check-out                          | 10    |
| Cambio de estado del reclamo                              | 12b   |

**Con las pantallas del cuidador y del dueño** (después de la 9):

- "Agregar al calendario" con `expo-calendar`, en `CuiAgenda` y en el detalle de la reserva.
- "Compartir perfil" con `Share` de React Native, en `CuiCompartir`.

**Terminado cuando:**

- Aceptar una solicitud le llega como push al dueño en el emulador.
- Si el usuario niega el permiso, nada falla.

### Etapa 12a: soporte y asistente

**Reglas:** §17. Solo depende de la base de la 11 (correo al equipo).

**API:**

- **Módulo `support`:**
  - `HelpNode` con `parentId`, `audience` (`OWNER` o `CAREGIVER`), `label`, `answer`, `action` (`NONE`, `WHATSAPP`, `CREATE_CASE` o `VET_EMERGENCY`) y `sortOrder`.
  - `SupportCase` con un número correlativo, usuario, `bookingId?`, `type` (`QUESTION`, `PROBLEM` o `GUARANTEE_CLAIM`), `path` (las opciones que recorrió) y `status`.
- **Endpoints:**
  - `GET /v1/help?audience=` devuelve el árbol completo, que es corto y se guarda en caché.
  - `POST /v1/support/cases` responde con `{ caseNumber, whatsappUrl | null, withinHours }`.
- **Horario:** la API decide si es dentro o fuera de horario con `support.hours`, en `America/El_Salvador`. Fuera de horario envía un correo al equipo con el módulo `notifications` de la base de la 11.
- **WhatsApp:** `whatsappUrl` es `https://wa.me/<número>?text=Caso%20<n>`, y el número va en el setting `support.whatsappNumber`.
- **Contenido:** el seed carga el árbol inicial de dueño y de cuidador.

**App:**

- Pantalla `ayuda` que muestra el árbol como burbujas, con Nimbus una sola vez.
- Abre WhatsApp con `Linking.openURL`.
- Acceso desde Cuenta del dueño y desde el centro de ayuda. Los accesos que dependen de otras etapas se agregan en ellas: "Tengo un problema" en el detalle de la reserva (12b) y Cuenta del cuidador (9).

**Terminado cuando:**

- Hay tests de dentro y fuera de horario con un reloj fijo.
- El nodo de emergencia muestra el teléfono del veterinario de la ficha.

### Etapa 12b: garantía

**Reglas:** §14. **Depende de** la etapa 10 (check-out, `CLOSED` y `Payout`) y de la 12a (`SupportCase`).

**API:**

- `POST /v1/bookings/:id/claims` crea un caso `GUARANTEE_CLAIM` y pasa la reserva a `DISPUTED` si está dentro del plazo. Agrega las filas de `DISPUTED` a `booking-status.ts`, cada una con su test.
- El script `claims:resolve <case> approve|reject` la pasa a `CLOSED` o deja el pago en `REFUND_PENDING`.
- El setting `disputes.resolutionBusinessDays` pasa a `guarantee.resolutionBusinessDays` (ver §2).

**App:** pantalla `Reclamo`, con el plazo que queda, y "Tengo un problema" en el detalle de la reserva, que abre el asistente o el reclamo.

**Terminado cuando:**

- Un reclamo fuera de plazo responde 422.
- Un reclamo congela el cierre de la etapa 10: la reserva `DISPUTED` no pasa a `CLOSED` a las 48 h.
- Aprobar un reclamo deja el pago en `REFUND_PENDING` y el cuidador no recibe ese pago.

## 4. Decisiones abiertas

Las que bloquean una etapa están marcadas.

| Decisión                              | Etapa                               | Valor provisional                      |
| ------------------------------------- | ----------------------------------- | -------------------------------------- |
| Rangos de visita y pernocta por nivel | 6                                   | Los de RN-PRE-01                       |
| Umbrales de los niveles               | 6                                   | Los de RN-NIV-02                       |
| Documentos exactos de antecedentes    | 9                                   | DUI, selfie y antecedentes o solvencia |
| Contenido del curso de bienvenida     | 9 (**bloquea**)                     | Ninguno: lo escribe el equipo          |
| Número de WhatsApp Business           | 12a                                 | Un número de prueba en el seed         |
| Contenido del asistente               | 12a (**bloquea**)                   | Ninguno: lo escribe el equipo          |
| URL para compartir el perfil          | 11                                  | `https://pawieapp.com`                 |
| Clave de Google Maps para Android     | 10 (**bloquea** el mapa en Android) | Ninguno                                |
