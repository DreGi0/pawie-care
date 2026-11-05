# Pawie Care: plan para llegar a la v0.6

**Fecha:** 2026-11-02 · **Punto de partida:** commit `410974a` (reglas v0.4 más la etapa 6 de la v0.5)

Este plan lleva el código a las [reglas v0.6](reglas-de-negocio.md). Cada etapa es un PR que deja el CI en verde. La etapa 6 ya está hecha; su detalle queda en §3 como referencia.

**Orden:** D → 9a → métricas → 7 → 8 → 9b → base de la 11 → 10 → eventos de la 11 → 12a → 12b.

**Dependencias:**

- **D** va primero, porque las pantallas del cuidador ya no tienen mockups en HTML: su referencia visual es la dirección que se elige en la D.
- **9a** termina con el cuidador en la búsqueda. Las **métricas** van después, porque el número crítico y el embudo cuentan lo que crea la 9a. La métrica de crecimiento necesita los referidos, así que se completa en "eventos de la 11".
- **7** y **8** no dependen entre sí, pero las dos van antes de la 10: la ruta del paseo necesita el paseo (8) y las tareas del tramo necesitan `PetScheduleItem` (7). La **9b** va después de las dos, porque la solicitud muestra la ficha ampliada y puede ser un paseo.
- La **base de la 11** (modelo `PushToken`, endpoint, envío por BullMQ y correo al equipo) no depende de nada, pero la 10 y la 12a la necesitan.
- **Eventos de la 11** conecta los avisos de la 9b y suma el calendario, compartir el perfil y los referidos. Los avisos de la 10 y de la 12b se conectan en su propia etapa.
- **12a** (asistente, centro de ayuda y casos) solo depende de la base de la 11. **12b** (garantía) depende de la 10 y de la 12a, porque el reclamo crea un caso de soporte.

## 1. Brecha entre el código y la v0.6

Los precios por nivel del cuidador, los niveles, los filtros de búsqueda y las certificaciones ya siguen las reglas (etapa 6), el cuidador se da de alta desde la app (etapa 9a), el reporte del piloto sale con un script (métricas), la ficha de la mascota está completa (etapa 7), el paseo es el tercer servicio (etapa 8) y el cuidador responde solicitudes y ve su agenda y sus ganancias (etapa 9b).

| Área                     | Hoy en el código                                                           | Falta para la v0.6                                                                   | Etapa            |
| ------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------- |
| Design system            | Placas (etapa D, hecha)                                                    | Nada                                                                                 | D                |
| Alta del cuidador        | Modo cuidador, documentos, curso, aprobación, perfil y precios (9a, hecha) | Nada                                                                                 | 9a               |
| Métricas del piloto      | Script `metrics:report` (métricas, hecha)                                  | Crecimiento (RN-MET-06), que necesita los referidos                                  | Eventos de la 11 |
| Ficha                    | Ficha completa y MascotaPerfil (7, hecha)                                  | Nada                                                                                 | 7                |
| Servicios                | Paseo, visita y pernocta (8, hecha)                                        | Nada                                                                                 | 8                |
| Solicitudes del cuidador | Solicitudes, aceptar o rechazar, agenda y ganancias (9b, hecha)            | Nada                                                                                 | 9b               |
| Ejecución                | Estados `IN_PROGRESS` a `CLOSED` sin transiciones                          | Check-in, tareas, fotos, ruta, check-out, cierre a las 48 h, pago simulado y reseñas | 10               |
| Avisos e integraciones   | Nada                                                                       | Push (base y eventos), agregar al calendario y compartir el perfil                   | 11               |
| Referidos                | Nada                                                                       | Código de cada cuidador, campo en el registro y quién refirió a cada dueño           | Eventos de la 11 |
| Soporte                  | Nada                                                                       | Asistente, centro de ayuda, casos y WhatsApp                                         | 12a              |
| Garantía                 | Nada                                                                       | Reclamo, estado `DISPUTED` y resolución                                              | 12b              |

## 2. IDs de reglas que cambiaron

**De la v0.4 a la v0.5.** Al tocar el código que los cita, se actualiza el comentario.

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

**En la v0.6** no cambia ningún ID. Se suman RN-REF-01 a RN-REF-03 y RN-MET-01 a RN-MET-07, y cambia el texto de RN-PRE-04 (comisión provisional), RN-PRE-09, RN-CUI-17 (sugerido del siguiente nivel), RN-CUI-22 (código de referido) y RN-RES-11. Las secciones "Ideas para después" y "Pendientes por validar" pasan a ser la §20 y la §21.

### Settings que cambian

Regla general: **no se renombra una clave si su significado no cambió**. Solo cambian la regla que cita.

| Clave actual                                       | En la v0.5                                                                                                                                            | Etapa     |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `certifications.specialCareMinExamScoreBp`         | `certifications.minExamScoreBp`, para todas las certificaciones (RN-CUI-08)                                                                           | 6 (hecha) |
| `certifications.specialCareValidityMonths`         | `certifications.validityMonths`, para todas las certificaciones (RN-CUI-09)                                                                           | 6 (hecha) |
| `certifications.specialCareMinAverageRatingTenths` | Sin cambio: sigue siendo solo de la ⭐ (RN-CUI-10)                                                                                                    | —         |
| `disputes.resolutionBusinessDays`                  | `guarantee.resolutionBusinessDays` (RN-GAR-03). Cambia el significado, porque ahora es el plazo de la garantía                                        | 12b       |
| `payments.payoutHoldMinutes`                       | **No se renombra.** Sigue en minutos, porque el registry guarda los plazos así. Solo cambia la regla que cita: de `RN-DIS-01` a RN-PAG-03 y RN-GAR-02 | 10        |

La v0.6 no agrega settings: las metas del reporte del piloto son constantes del script (RN-MET-01).

## 3. Etapas

### Etapa 6: precios por nivel del cuidador (hecha)

**Avance:** se hace en dos PR. **6.1 (hecha, solo API):** `CaregiverLevel` y `CaregiverProfile.level`, `CaregiverSkill`, tipos de certificación, settings `certifications.minExamScoreBp`, `certifications.validityMonths` y `levels.requirements`, `caregiver-level.ts`, recálculo en la transacción (`recalculateLevel`), el script `caregivers:recalculate-levels` y el seed con los cuatro niveles. **6.2:** se parte en API y app. **API (hecha):** precios por nivel del cuidador (`CaregiverServicePrice` sin `careLevel`, `pricing.priceRanges` de visita y pernocta), tarifa 15% y comisión 0%, `pricing.firstServiceWindowDays`, `Booking.caregiverLevel` y `firstServiceFeeWaived` (con el dueño bloqueado en la transacción), `POST /v1/bookings/quote`, `firstServiceFeeWaiverEndsAt` en `GET /v1/users/me`, y los filtros `minLevel`, `certificationCodes` y `minRating` con `level`, `badges`, `certifications` y `skills` en búsqueda y perfil. **App (hecha):** filtros y nivel en Main, perfil con nivel, insignias, certificaciones y habilidades, el total de Reservar y la línea de Pagar desde `/quote` y la reserva (se borró `estimatePrice`), la tarifa tachada en $0.00 con "Primer servicio" y el aviso con los días que quedan. Para que Reservar pueda cotizar antes de que el dueño llene el contacto de emergencia, `/quote` dejó de pedir `emergency`, que no cambia el precio. `BookingPrice` agrega `waivedServiceFeeCents` (lo que habría costado la tarifa, guardado en el `pricing_snapshot`) para mostrarlo tachado junto al $0.00. **La etapa 6 está hecha.**

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
- `POST /v1/bookings/quote`: mismo cuerpo que `POST /v1/bookings`, menos `emergency`, que no cambia el precio. Devuelve `BookingPrice` sin guardar nada y sin tomar el primer servicio sin tarifa: solo lo toma la reserva. Usa las mismas funciones de `src/pricing/`.
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

### Etapa D: nuevo design system (hecha)

Dirección **Placas**; detalle en [docs/design/README.md](design/README.md#design-system-placas). **Parte 1 (hecha, solo docs):** dos direcciones exploradas en HTML y Placas elegida, con sus mockups en `docs/design/directions/`. **Parte 2 (hecha, app):** tokens y fuentes (Gabarito y Lexend en lugar de Nunito), componentes nuevos (placas, placa del nivel, foto con la silueta de Nimbus, bloques de servicio y filas) y el layout de Main, Perfil, Reservar, Visitas y Mis mascotas. Los mockups de `docs/design/screens/` quedan como referencia de textos de la v0.4. **La etapa D está hecha.**

### Etapa 9a: alta del cuidador (hecha)

**Referencia visual:** la dirección elegida en la etapa D. Esta etapa no necesita mockups en HTML.

**Avance:** se hizo en dos PR, API y app. **API (hecha):**

- Endpoints `caregivers/me` (con `level`, `prices` y `prices/quote`), `courses/welcome` (con `attempts`) y `mode` en `/v1/users/me`, que guarda el último modo en la cuenta.
- El DUI se sube por los dos lados (`ID_DOCUMENT_FRONT` y `ID_DOCUMENT_BACK`), y los documentos quedan fijos al aprobarse el alta.
- `isActive` pasó a `isPaused` (RN-CUI-20), porque "activo" se confundía con "aprobado". La migración conserva el estado de cada cuidador, y los que ya estaban aprobados quedan con el curso aprobado.
- `caregivers:approve` exige los documentos, pero no el curso.
- El curso tiene 4 módulos con 3 preguntas cada uno, marcados `TODO(contenido)`, y su nota mínima es `certifications.minExamScoreBp`.

**App (hecha):**

- CuiActivar desde Cuenta y las pestañas por modo: Inicio y Cuenta para el cuidador.
- CuiInicio, CuiDocumentos, CuiCurso, CuiPerfil y CuiPrecios, con Placas (`docs/design/README.md`).
- El horario se edita por franjas: mañana, tarde y la noche de la pernocta.
- La calculadora pide lo que recibe a `/prices/quote` 400 ms después del último −/+.
- Las subidas usan `File` de expo-file-system con `expo/fetch`, porque `fetch(uri).blob()` leía mal los archivos locales en SDK 58. Eso también arregla la foto de la mascota.

**La etapa 9a está hecha.**

**Reglas:** RN-CTA-06, RN-CUI-01 a RN-CUI-04, RN-CUI-16 a RN-CUI-20, RN-NIV-05, RN-PRE-04.

**API:**

- **Modo cuidador:** `POST /v1/caregivers/me` crea el perfil en `PENDING_APPROVAL`. `GET` y `PATCH /v1/caregivers/me` manejan perfil, habilidades, distritos, horario, precios, Reserva inmediata y pausa.
- **Documentos:** `FilePurpose` agrega `ID_DOCUMENT`, `SELFIE` y `BACKGROUND_CHECK`. Solo los ven el dueño del archivo y los administradores.
- **Curso de bienvenida:**
  - `GET /v1/courses/welcome` devuelve módulos y preguntas, sin las respuestas.
  - `POST /v1/courses/welcome/attempts` califica en la API y guarda el intento.
  - El contenido viene del seed.
- **Aprobación:** el script `caregivers:approve <email>` aprueba el perfil y marca las insignias.
- **Búsqueda:** desde esta etapa exige el curso de bienvenida aprobado (RN-CUI-03). Antes, solo exige perfil aprobado y activo. Los cuidadores del seed quedan con el curso aprobado, o dejarían de salir en las búsquedas.
- **Progreso:** `GET /v1/caregivers/me/level` devuelve el nivel y lo que le falta, con la función de la etapa 6.
- **Precios y calculadora (RN-CUI-17, RN-PRE-04):**
  - `GET /v1/caregivers/me/prices` devuelve, por servicio, su precio, lo que recibe con ese precio, el rango y el sugerido de su nivel, y el sugerido del siguiente nivel (null para un Súper Cuidador). Lo usan Precios e Inicio.
  - Mientras el cuidador edita un precio, la app le pide a la API lo que recibiría (`POST /v1/caregivers/me/prices/quote`); no lo calcula.
  - Un precio fuera del rango responde 422.
  - Hasta la etapa 8 solo hay visita y pernocta.

**App:**

- Activar el modo cuidador desde Cuenta.
- Pestañas del cuidador: Inicio y Cuenta. Agenda y Ganancias llegaron en la 9b.
- Alta: documentos y curso, con el estado de cada paso.
- Perfil: foto, descripción, habilidades, distritos, horario semanal, Reserva inmediata y pausa.
- Precios con la calculadora: el rango y el sugerido de su nivel, el sugerido del siguiente nivel ("En Pro, tu paseo sugerido sube de $6.50 a $11") y lo que recibe. Ningún texto dice "recibes el 100%".
- Inicio: lo que le falta del alta y, ya aprobado, su nivel, lo que le falta para el siguiente y el sugerido del siguiente nivel por servicio.

**Terminado cuando:**

- Una cuenta de dueño activa el modo cuidador, sube sus documentos, aprueba el curso, se aprueba con el script, llena perfil, horario, distritos y precios, y aparece en la búsqueda de otra cuenta.
- Un precio fuera del rango responde 422.
- Con `pricing.caregiverCommissionBp` en 1000 (`settings:set`), Precios muestra lo que recibe con el 10% sin cambiar la app.
- Un Súper Cuidador no ve el sugerido del siguiente nivel.

### Etapa de métricas: reporte del piloto (hecha)

**Reglas:** RN-MET-01 a RN-MET-07.

**API (hecha, la etapa no toca la app):**

- Script `metrics:report` en `src/metrics/`, con el runner de los demás scripts: solo lee la base y escribe una tabla en la consola. `pilot-targets.ts` tiene las metas, `pilot-report.ts` las consultas y las líneas, y `metrics-report.command.ts` los argumentos.
- Las metas, los umbrales y los plazos son constantes en `pilot-targets.ts`, no settings, y no van en la §15 (RN-MET-01).
- `--from` y `--to` son opcionales: días en El Salvador, con los dos extremos incluidos. Filtran cada grupo por cuándo entró: el embudo y Oferta por la creación del perfil de cuidador, Valor por el registro del dueño y Retención por su primer pago. El número crítico es siempre el de hoy, porque la pausa y el horario no guardan historial. Sin fechas, el reporte usa todo el historial.
- Una reserva pagada es una con su estado en `CONFIRMED_STATUSES`, que ahora se exporta de `booking-status.ts`. Su fecha de pago es su primer `BookingStatusChange` a `CONFIRMED`.
- Las cuentas del seed (`@example.com`) no cuentan, así que con el seed de demo todo sale en 0. Las factories de los tests aceptan otro correo.
- Número crítico: menos de 15 es "bajo el mínimo", de 15 a 24 "rojo", de 25 a 34 "verde" y desde 35 "súper verde" (RN-MET-02). Las hipótesis muestran el porcentaje, el numerador, el denominador, la meta y si "cumple" o "no cumple". Con el denominador en 0 dicen "sin datos". El embudo no tiene meta: muestra el % de cada paso sobre el anterior.
- Crecimiento (RN-MET-06) dice "sin datos todavía" hasta "eventos de la 11", que agrega los referidos.
- Hay un solo test, `test/metrics.e2e-spec.ts`, en lugar de un `.spec.ts` por métrica.

**Terminado cuando:**

- El número crítico no cuenta a un cuidador pausado, sin horario, sin el curso o con distritos solo fuera de San Salvador y Santa Tecla, ni a una cuenta del seed.
- Con un reloj fijo, Valor cuenta al dueño que paga su primera reserva el día 15 y no al que la paga el día 16, y no cuenta a un dueño registrado hace menos de 15 días.

**La etapa de métricas está hecha.**

### Etapa 7: ficha ampliada

**Reglas:** RN-MAS-02, RN-MAS-11, RN-MAS-12 (para el diseño de los horarios).

**Avance:** se hace en dos PR, API y app. **API (hecha):**

- `Pet` suma la rutina y el celo, en el mismo `PUT` que reemplaza toda la ficha.
- El celo lleva las dos fechas o ninguna, y es **solo para hembras** (RN-MAS-11): un macho responde 422 `HEAT_ONLY_FOR_FEMALES`. Una hembra esterilizada sí lo admite, porque el dato puede faltar o estar mal. No toca el nivel de cuidado: hay un test de búsqueda.
- `PetScheduleItem` lleva además `careNeedId`, y se maneja con `POST`, `PUT` y `DELETE /v1/pets/:petId/schedule-items`. `PetDetail.scheduleItems` viene ordenado por hora.
  - `minuteOfDay` es la hora de El Salvador, como en el horario del cuidador.
  - Una **dosis** cuelga de una tarea `MEDICATION` de la misma mascota (RN-CUI-12): de ella salen sus fechas y sus indicaciones del veterinario, y con ella la mascota es Especial. Sin la tarea responde 422 `MEDICATION_TASK_REQUIRED`. Borrar la tarea borra sus dosis, y cambiarla a otra tarea mientras tiene dosis responde 409 `CARE_NEED_HAS_DOSES`.
  - Una **comida** es de todos los días y no lleva tarea.
  - El `PUT` conserva el id, para que la etapa 10 arme con él la clave de cada tarea.
- El texto libre `medications` queda, pero solo informa: en la app es "Medicamentos que toma", y ninguna pantalla del cuidador lo muestra como instrucción (RN-MAS-02).
- `GET /v1/catalog` suma `careTasks`, con el nombre, el grupo y si puede quedar sin fecha de fin. Así la app no copia los grupos.
- La migración tiene los `CHECK` del celo y de los horarios, y la llave compuesta que ata la dosis a una tarea de la misma mascota.
- Toby y Nala, en el seed, tienen alimento, rutina y comidas.

**Diseño original:**

- `Pet` agrega `foodDescription`, `foodPortion`, `allowedTreats`, `dailyRoutine`, `heatStartsOn` y `heatEndsOn` (`date`).
- `PetScheduleItem` con `petId`, `kind` (`MEAL` o `MEDICATION`), `minuteOfDay`, `label` y `dose?`. Sirve para la ficha y para las tareas del tramo de la etapa 10.

**App:** pantalla **Perfil de la mascota**, que ya estaba pendiente en `docs/design/README.md`. Muestra y edita la ficha: rutina, horarios, salud, tareas de cuidado e indicaciones, y el celo.

**App (hecha):**

- **MascotaPerfil** (`mascotas/[id]`) se abre desde Mis mascotas. Muestra la ficha por partes, cada una con su pantalla de edición: datos, rutina, horario, salud, vacuna, tarea y celo. Sus reglas están en `docs/design/README.md`.
- Cada pantalla de texto arma el `PetRequest` completo (`petRequest` en `src/lib/pets.ts`), porque el `PUT` reemplaza toda la ficha.
- Una dosis se elige de una tarea de Medicación. Sin una, la app lleva a crearla, con las indicaciones subidas en foto o PDF, y al volver la deja elegida.
- La hora se escribe como `HH:MM` con máscara, sin módulos nativos nuevos.
- "Medicamentos que toma" lleva la ayuda "Si el cuidador tiene que dárselos, agrégalos como tarea de cuidado."
- `PetForm` edita los datos con peso y esterilización, y conserva el resto de la ficha.

**La etapa 7 está hecha.**

**Terminado cuando:**

- Un horario de comida a las 7:00 aparece en la ficha.
- Una mascota en celo no cambia su `careLevel`.

### Etapa 8: servicio de paseo (hecha)

**Reglas:** RN-SER-05, RN-RES-01, RN-RES-03, RN-PRE-01.

**Avance:** se hace en dos PR, API y app. **API (hecha):**

- `ServiceCode.WALK`, `services.walkDurationMinutes` y `bookings.maxDogsPerWalk`. La migración suma el rango del paseo a `pricing.priceRanges` solo si falta, así que no deshace un `settings:set`. La fila de `services` la crea el seed, como la de los otros servicios.
- Un paseo lleva solo `walks`: ni noches ni visitas. Se pueden pedir varios en un día.
- `planBooking` revisa las especies, así que la búsqueda, `/quote` y la reserva responden igual: `WALK_ONLY_FOR_DOGS`, con las mascotas que no son perros en `details`, o `TOO_MANY_DOGS_PER_WALK`. El segundo perro suma el 50%, como cualquier mascota adicional (RN-PRE-02).
- `GET /v1/catalog` suma `services[].speciesCodes`, `bookingRules.walkMinutes` y `bookingRules.maxDogsPerWalk`, para que la app no copie la regla.
- Precios del cuidador: el paseo sale solo, y un cuidador nuevo empieza ofreciéndolo al sugerido, como los otros servicios.
- El seed le da paseo a 7 de los 10 cuidadores. Andrea, María José y Sofía no pasean perros.
- El ejemplo de RN-PRE (paseo con un cuidador Confiable) ya es un test con `WALK`.

**App (hecha):**

- Main tiene el bloque Paseo primero, "Solo perros", como en `directions/placas/main.html`. Abre en Paseo si la primera mascota es perro, y en Visita si no.
- Con un gato elegido, o más de 2 perros, tocar Paseo abre una hoja que explica por qué y no quita a nadie sin que el dueño lo elija. Con Paseo, "¿Para quién?" muestra solo los perros.
- Reservar, Pagar, el detalle de la reserva, el perfil del cuidador, CuiPrecios y CuiInicio nombran el paseo. Los servicios van siempre en el orden paseo, visita y pernocta.
- La app pide un paseo por reserva, como la visita. Varios en un día ya funcionan en la API.

**La etapa 8 está hecha.**

**Diseño original:**

- `ServiceCode.WALK`, con los settings `services.walkDurationMinutes = 45` y `bookings.maxDogsPerWalk = 2`.
- `pricing.priceRanges` suma el rango del paseo (RN-PRE-01).
- `CreateBookingRequest.walks?: string[]`, con el inicio de cada paseo.
- El plan de tramos (`slot-plan.ts`) y la disponibilidad tratan el paseo como un tramo de 45 min.
- Si se elige un gato o más de 2 perros, la API responde 422 con un `errorCode` propio.

**App:** el paseo en la búsqueda, en Reservar y en Precios del cuidador (9a). Al elegir paseo, solo se pueden elegir perros.

**Terminado cuando:**

- Hay tests del plan de tramos para el paseo.
- Hay un test de la exclusión entre un paseo y una visita del mismo cuidador.
- Hay un test de que no se puede reservar un paseo para un gato.

### Etapa 9b: solicitudes, agenda y ganancias

**Referencia visual:** la dirección elegida en la etapa D. Esta etapa no necesita mockups en HTML.

**Reglas:** RN-RES-06, RN-RES-11, RN-CTA-04, RN-PAG-10.

**Avance:** se hace en dos PR, API y app. **API (hecha):**

- `GET /v1/caregivers/me/bookings?status=&upcoming=` y `GET /v1/caregivers/me/bookings/:id` devuelven la reserva como la ve el cuidador. Primero van las solicitudes, la que vence primero arriba (RN-RES-06), y después el resto, por inicio. `upcoming=true` deja fuera lo que ya terminó, para la agenda.
- Cada mascota trae su ficha para las fechas de la reserva: las tareas activas, las comidas, las dosis de las tareas de Medicación activas, las indicaciones adjuntas, `inHeat` y el nivel de cuidado guardado al reservar. "Medicamentos que toma" viene solo como dato (RN-MAS-02).
- `earnings` trae lo que va a ganar, guardado al reservar (RN-PRE-07): subtotal, comisión y `payoutCents`. La app muestra `payoutCents`.
- La dirección exacta y los datos de emergencia vienen desde `CONFIRMED` (RN-CTA-04, que ahora nombra también los datos de emergencia).
- `POST /v1/bookings/:id/accept` y `/reject` responden 404 si la reserva es de otro cuidador, y 409 `BOOKING_NOT_REQUESTED` si ya no está `REQUESTED` o si su plazo pasó, aunque todavía no haya vencido.
- `GET /v1/caregivers/me/earnings`: por cobrar (reservas confirmadas o en retención), pagado (0 hasta la etapa 10) y el total del mes en curso, hora de El Salvador, según el inicio de cada servicio.

**App (hecha):**

- Pestañas del cuidador: Inicio, Agenda, Ganancias y Cuenta.
- CuiInicio lista las solicitudes, la que vence primero arriba, con "En celo" o "Especial", el plazo y lo que va a ganar. Mientras está abierta vuelve a preguntar cada 30 s, porque los avisos llegan en "eventos de la 11".
- CuiSolicitud muestra lo que va a ganar en grande, el servicio, el distrito, las instrucciones del dueño y la ficha de cada mascota para esas fechas. "Medicamentos que toma" sale solo en Salud, con la nota "Lo informa el dueño. Solo das las medicinas que están en las tareas del servicio." Aceptar es el botón primario y Rechazar pide confirmación. Desde `CONFIRMED` suma la dirección exacta y los datos de emergencia.
- CuiAgenda agrupa por día cada paseo, visita o noche que no ha terminado, incluidas las reservas que esperan el pago. Una que vence sale sola.
- CuiGanancias muestra el total del mes, por cobrar, pagado y la lista de lo que tiene por cobrar.
- Esperando, del dueño, cambia sola cuando el cuidador responde.
- Se probó en el emulador con la cuenta de demo y `andrea@example.com`: el dueño pide una visita para Toby y Luna, que está en celo, y Andrea ve $12.00, el `caregiver_payout_cents` de la reserva, y la acepta. El pago se marcó a mano en la base local, porque en local no hay llaves de Wompi.

**La etapa 9b está hecha.**

**API:**

- **Solicitudes:**
  - `GET /v1/caregivers/me/bookings?status=` lista las reservas del cuidador.
  - `POST /v1/bookings/:id/accept` y `POST /v1/bookings/:id/reject` usan las transiciones que ya existen en `booking-status.ts`.
  - La respuesta trae lo que va a ganar el cuidador, calculado en la API (RN-RES-11, RN-PRE-04), y la dirección exacta solo si la reserva está `CONFIRMED` o en un estado posterior (RN-CTA-04).
  - La ficha muestra el celo. Los "medicamentos que toma" van solo como dato, nunca como instrucción (RN-MAS-02).
  - Los eventos push de esta etapa se conectan en "eventos de la 11".
- **Ganancias:** `GET /v1/caregivers/me/earnings` devuelve lo que tiene por cobrar, lo pagado y el total del mes. Hasta la etapa 10 no existe `Payout`, así que "pagado" es 0 y "por cobrar" sale de las reservas `CONFIRMED`; la etapa 10 completa el resto.

**App:**

- Pestañas Agenda y Ganancias.
- Inicio suma las solicitudes pendientes, la más urgente primero.
- Detalle de la solicitud: aceptar o rechazar.
- Agenda: próximos servicios por día.
- Ganancias.

**Terminado cuando:**

- Un cuidador dado de alta en la 9a acepta una solicitud hecha desde otro emulador.
- Lo que va a ganar es el monto que devuelve la API.

### Base de la etapa 11: push y correo al equipo

**Reglas:** RN-NOT-03. No depende de nada; la 10 y la 12a la reutilizan.

- Modelo `PushToken` y `POST /v1/users/me/push-tokens`.
- Módulo `notifications`, que envía con la API HTTP del Expo Push Service usando el `fetch` de Node, sin SDK. El envío va por BullMQ para no frenar la petición.
- App: pedir el permiso y registrar el token con `expo-notifications`, que necesita una development build. Si el usuario niega el permiso, nada falla (RN-NOT-03).
- **Correo al equipo** en el mismo módulo `notifications` (arquitectura §5): Mailpit en local y Resend en la demo. Lo usan la 12a (casos fuera de horario) y RN-EJE-02 (etapa 10). No se crea otro mecanismo de correo.

**Terminado cuando:**

- Si el usuario niega el permiso, nada falla.
- Un correo al equipo llega a Mailpit.

### Etapa 10: ejecución del servicio y reseñas

**Reglas:** §11, RN-PAG-03, RN-RSE-01, RN-RSE-06.

**API:**

- **Check-in y check-out:** `POST /v1/bookings/:id/slots/:slotId/check-in` y `/check-out`, con hora y ubicación.
  - El primer check-in pasa la reserva a `IN_PROGRESS`, y el check-out del último tramo, a `COMPLETED`.
  - El check-out exige las fotos mínimas. El del último tramo incrementa `completedBookingCount` del cuidador y recalcula su nivel.
- **Fotos:** `FilePurpose.CARE_LOG_PHOTO`, en `POST /v1/bookings/:id/slots/:slotId/photos`.
- **Tareas del tramo:** `GET /v1/bookings/:id/slots/:slotId/tasks` arma la lista con `PetScheduleItem` y las tareas de cuidado activas. `POST …/tasks/:taskKey/done` marca una tarea como hecha.
  - Las comidas entran todos los días. Las dosis entran solo los días en que su tarea `MEDICATION` está activa.
  - El texto libre `medications` nunca es una tarea (RN-MAS-02).
- **Ruta:** `POST /v1/bookings/:id/slots/:slotId/route` recibe lotes de puntos `{ lat, lng, recordedAt }`, y `GET …/route` los devuelve. Cada punto se guarda como una fila de `RoutePoint`.
- **Colas:**
  - Una tarea diferida avisa si no hay check-in a los [30 min] (RN-EJE-02), por push al dueño (base de la 11) y por correo al equipo.
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

### Eventos de la etapa 11: avisos, calendario, compartir y referidos

**Reglas:** RN-NOT-01, RN-NOT-02, RN-CAL-01, RN-CUI-22, RN-REF-01 a RN-REF-03, RN-MET-06.

**Eventos de RN-NOT-01 y RN-NOT-02**, llamando al módulo `notifications` desde el servicio que cambia el estado. Aquí se conectan los de la 9b, porque la base todavía no existía. Los de la 10 y la 12b se conectan en su propia etapa:

| Evento                                                    | Etapa |
| --------------------------------------------------------- | ----- |
| Solicitud nueva, aceptada o rechazada; reserva confirmada | 9b    |
| Reserva cancelada por el dueño                            | 9b    |
| Check-in, foto nueva y check-out                          | 10    |
| Cambio de estado del reclamo                              | 12b   |

**Calendario y compartir:**

- "Agregar al calendario" con `expo-calendar`, en `CuiAgenda` y en el detalle de la reserva.
- "Compartir perfil" con `Share` de React Native, en `CuiCompartir`. El texto lleva nivel, calificación, insignias, código de referido y la URL (RN-CUI-22, RN-REF-02).

**Referidos:**

- `CaregiverProfile.referralCode`, único. Lo crea `caregivers:approve`, y los cuidadores que ya estaban aprobados, los del seed incluidos, reciben el suyo en esta etapa. `GET /v1/caregivers/me` lo devuelve.
- `RegisterRequest.referralCode?`, que se compara sin distinguir mayúsculas. Si no existe, responde 422 con el `errorCode` `REFERRAL_CODE_NOT_FOUND` y un mensaje en español. Si existe, `User.referredByCaregiverId` guarda el cuidador.
- `metrics:report` suma la métrica de crecimiento (RN-MET-06).

**App:** campo opcional "¿Te recomendó un cuidador?" en Registro, que muestra el mensaje de la API si el código no existe.

**Terminado cuando:**

- Aceptar una solicitud le llega como push al dueño en el emulador.
- Un registro con un código que no existe responde 422 y no crea la cuenta. Con uno válido, la cuenta guarda el cuidador que la refirió.
- El texto que se comparte incluye el código.
- El reporte muestra la métrica de crecimiento.

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
- Acceso desde Cuenta del dueño, Cuenta del cuidador y el centro de ayuda. "Tengo un problema", en el detalle de la reserva, se agrega en la 12b.

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

| Decisión                              | Etapa                               | Valor provisional                                                                    |
| ------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------ |
| Comisión al cuidador: 0% o 10%        | 9a y 9b                             | 0% (RN-PRE-04)                                                                       |
| Rangos de visita y pernocta por nivel | 6                                   | Los de RN-PRE-01                                                                     |
| Umbrales de los niveles               | 6                                   | Los de RN-NIV-02                                                                     |
| Documentos exactos de antecedentes    | 9a                                  | DUI por los dos lados, selfie y antecedentes o solvencia                             |
| Contenido del curso de bienvenida     | 9a                                  | 4 módulos de ejemplo marcados `TODO(contenido)`; el texto final lo escribe el equipo |
| URL para compartir el perfil          | Eventos de la 11                    | `https://pawieapp.com`                                                               |
| Clave de Google Maps para Android     | 10 (**bloquea** el mapa en Android) | Ninguno                                                                              |
| Número de WhatsApp Business           | 12a                                 | Un número de prueba en el seed                                                       |
| Contenido del asistente               | 12a (**bloquea**)                   | Ninguno: lo escribe el equipo                                                        |
