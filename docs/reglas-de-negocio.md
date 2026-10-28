# Pawie Care: reglas de negocio

**Versión:** 0.5 · **Fecha:** 2026-10-28 · **Estado:** aprobada para planificar. Reemplaza a la v0.4.

La v0.5 alinea el producto con los documentos de negocio del equipo (Buyer diferencial, Promesa, Vehículo y Pricing). Esos documentos no están en este repositorio. Este archivo es su traducción a reglas que se pueden programar, así que **en el código manda este archivo**.

## Cómo leer este documento

- Cada regla tiene un ID (`RN-XXX-00`) para citarla en el código, los tests y los tickets. Los IDs de la v0.4 se conservan cuando la regla sigue viva, aunque cambie su contenido.
- Los valores entre corchetes, como **[15%]**, son **parámetros configurables**. Están todos en la [sección 15](#15-parámetros-configurables).
- **`[DEFINIR: …]`** marca una decisión de negocio pendiente. Si tiene un valor provisional, se programa con ese valor. Si no lo tiene, no se inventa: se pregunta.
- Cada sección empieza con una línea **En la demo** que dice qué parte se construye ahora. Lo que no se menciona ahí es Fase 2. Aun así, el modelo de datos debe contemplarlo para no rehacerlo después.
- El orden de construcción está en [plan-v0.5.md](plan-v0.5.md).

## Cambios desde la v0.4

| Tema                   | v0.4                                           | v0.5                                                                                                         | Reglas                    |
| ---------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------- |
| Diferencial            | Cuidado especial ⭐                            | Cuidadores verificados con **niveles**, y fotos y ruta de cada servicio                                      | §1                        |
| Qué define el precio   | El nivel de la **mascota** (Normal o Especial) | El **nivel del cuidador** (Nuevo, Confiable, Pro o Súper Cuidador)                                           | RN-NIV, RN-PRE-01         |
| Cuidado especial ⭐    | Certificación única que sube el precio         | Una **certificación más**. Sigue siendo obligatoria para atender una mascota Especial, pero no cambia precio | RN-CUI-07, RN-MAS-06      |
| Servicios              | Visita y pernocta                              | Se suma el **paseo**                                                                                         | RN-SER-05                 |
| Tarifa y comisión      | El dueño paga +10% y el cuidador cede 15%      | El dueño paga **+15%** y el cuidador recibe el **100%** de su precio                                         | RN-PRE-03, RN-PRE-04      |
| Incentivo              | No había                                       | **Primer servicio sin tarifa** si se reserva dentro de [15 días] desde el registro                           | RN-PRE-09                 |
| Garantía               | Daños y reemplazo, en Fase 2                   | **Reembolso del 100%** con reclamo en [48 h], en la demo                                                     | RN-GAR                    |
| Cuidadores             | Datos de prueba, sin app                       | **App del cuidador**: alta, verificación, curso de bienvenida, perfil, solicitudes, servicio y ganancias     | §4, §11                   |
| Aceptación             | Animación simulada de 5 s                      | El cuidador acepta o rechaza en su app. Los cuidadores del seed siguen con Reserva inmediata                 | §2, RN-CUI-16             |
| Ejecución del servicio | Fase 2                                         | Check-in, tareas, fotos, ruta GPS del paseo y check-out, en la demo                                          | §11                       |
| Reseñas                | Datos de prueba                                | El dueño califica al cuidador, en la demo. Las reseñas en los dos sentidos siguen en Fase 2                  | §13                       |
| Ficha de la mascota    | Salud y tareas de cuidado                      | Se suman alimento, horarios, premios, rutina y celo                                                          | RN-MAS-02, RN-MAS-11      |
| Soporte                | No había                                       | **Asistente de opciones guiadas**, centro de ayuda y WhatsApp Business                                       | §17                       |
| Avisos e integraciones | No había                                       | Notificaciones push, agregar al calendario y compartir el perfil del cuidador                                | RN-NOT, RN-CAL, RN-CUI-22 |

---

## 1. Contexto

- Pawie es un marketplace que conecta **dueños de perros y gatos** con **cuidadores verificados**. Arranca en **San Salvador y Santa Tecla**; el catálogo de distritos cubre el Área Metropolitana de San Salvador (AMSS). Los precios están en **dólares (USD)**.
- **Dueño:** viaja, trabaja o estudia y hoy depende de su familia o de grupos de Facebook. Quiere un cuidador de confianza en minutos, ver a su mascota durante el servicio y que se respete su rutina.
- **Cuidador:** normalmente un estudiante o alguien que busca un ingreso extra con [10 h] o menos a la semana. Quiere clientes cerca de su zona, cobrar más al subir de nivel y el pago garantizado.
- **Lo que diferencia a Pawie:**
  - Cuidadores con identidad y antecedentes verificados, con nivel, insignias y calificación a la vista.
  - Fotos y ruta de cada servicio mientras ocurre.
  - La ficha de la mascota, que el cuidador sigue en cada servicio.
  - Garantía de reembolso.
- **Pawie no es un servicio veterinario.** Los cuidadores no diagnostican ni recetan; solo siguen indicaciones escritas del veterinario de la mascota.

## 2. Alcance de la demo

La demo es una **app móvil** (iOS y Android) con dos modos en la misma app: **dueño** y **cuidador**. La web viene después.

**Flujo del dueño:**

1. Registrarse e iniciar sesión.
2. Registrar sus mascotas con su ficha.
3. Buscar y filtrar cuidadores por nivel, certificaciones y calificación, y ver sus perfiles.
4. Reservar y pagar con Wompi en modo de prueba, con el primer servicio sin tarifa.
5. Seguir el servicio: fotos, tareas y ruta del paseo.
6. Calificar al cuidador y, si algo sale mal, reclamar la garantía.
7. Resolver dudas con el asistente y hablar con el equipo por WhatsApp.

**Flujo del cuidador:**

1. Activar el modo cuidador, subir sus documentos y hacer el curso de bienvenida.
2. Armar su perfil: foto, descripción, habilidades, distritos, horario y precios.
3. Aceptar o rechazar solicitudes.
4. Hacer el servicio: check-in, tareas, fotos, ruta y check-out.
5. Ver su nivel, lo que le falta para subir y sus ganancias.
6. Compartir su perfil y usar el asistente.

**Lo que la demo resuelve de otra forma:**

- **Aprobación de cuidadores:** un administrador aprueba con un script, porque el panel de administración es Fase 2.
- **Certificaciones avanzadas:** las otorga el seed o un script. Los cursos avanzados de pago son Fase 2.
- **Pago al cuidador:** se calcula y se muestra, pero la transferencia es simulada.
- **Reembolsos:** se hacen en el panel de Wompi y se registran con un script (RN-PAG-05).
- **Cuidadores de prueba:** el seed carga cuidadores aprobados en los cuatro niveles, con Reserva inmediata, para que se pueda reservar sin un segundo teléfono.
- **Parámetros y contenido del asistente:** se cambian con un script o con el seed.

**Fuera de la demo:** web y perfiles públicos, panel de administración, cursos avanzados de pago, pago real a cuidadores, pago por transferencia, cancelaciones después de pagar, reemplazos, solicitudes abiertas, encuentro previo, botón de emergencia, reseñas del cuidador al dueño, chat interno, hospedaje en casa del cuidador y los demás servicios de la [sección 18](#18-ideas-para-después).

---

## 3. Cuentas y roles

**En la demo:** registro e inicio de sesión, y activar el modo cuidador desde la misma cuenta.

- **RN-CTA-01** Hay tres roles: **dueño**, **cuidador** y **administrador**. Una misma cuenta puede ser dueño y cuidador a la vez.
- **RN-CTA-02** Solo pueden registrarse mayores de 18 años.
- **RN-CTA-03** El dueño debe verificar su identidad (DUI) antes de su primera **pernocta**, para proteger al cuidador que entra a su casa. `Fase 2`
- **RN-CTA-04** El teléfono del cuidador y la dirección del dueño quedan ocultos hasta que existe una reserva confirmada entre los dos.
- **RN-CTA-05** El administrador aprueba cuidadores, resuelve reclamos y edita los parámetros. En la demo lo hace con scripts.
- **RN-CTA-06** Toda cuenta empieza como dueño. Desde **Cuenta** puede activar el **modo cuidador**, lo que crea su perfil de cuidador en `PENDING_APPROVAL`. La app cambia de pestañas según el modo, y la cuenta recuerda el último que usó.

## 4. Cuidadores

### 4.1 Alta y verificación

**En la demo:** todo, salvo que la aprobación se hace con un script.

- **RN-CUI-01** Para darse de alta, el cuidador sube su **DUI**, una **selfie** de verificación y su **constancia de antecedentes penales** o la **solvencia de la PNC**. `[DEFINIR: documentos exactos con el abogado]`. Los documentos van en el bucket privado y solo los ven el cuidador y los administradores.
- **RN-CUI-02** Antes de aparecer en búsquedas debe aprobar el **curso de bienvenida**: reglas de la plataforma, manejo de perros y gatos, respetar la ficha y la rutina, y qué hacer en una emergencia. Es gratis, está dentro de la app y termina con un examen de al menos **[80%]**, que se puede repetir.
- **RN-CUI-03** Un administrador aprueba cada alta y con eso se marcan las insignias **Identidad verificada** y **Antecedentes verificados**. Solo los cuidadores aprobados, activos y con el curso de bienvenida aprobado aparecen en búsquedas.
- **RN-CUI-04** El cuidador elige los **distritos** que cubre y mantiene su horario semanal.

### 4.2 Perfil y configuración

**En la demo:** todo.

- **RN-CUI-18** El cuidador configura desde la app, sin ayuda del equipo:
  - **Perfil:** foto, descripción y experiencia.
  - **Habilidades declaradas**, de un catálogo: perros grandes, gatos, cachorros, mascotas mayores y comportamiento difícil.
  - **Distritos** y **horario semanal** (RN-CUI-04).
  - **Precios** (RN-CUI-17) y **Reserva inmediata** (RN-CUI-16).
- **RN-CUI-19** Las **habilidades declaradas** no están verificadas, así que se muestran como etiquetas y no como insignias, y no sirven para filtrar. Lo verificado son las insignias y las certificaciones (§4.3).
- **RN-CUI-20** El cuidador puede **pausar** su perfil. Mientras está pausado no aparece en búsquedas, pero conserva sus reservas.

### 4.3 Insignias y certificaciones

**En la demo:** todas las insignias. Las certificaciones las otorga el seed o un script.

- **RN-CUI-05** El cuidador que presenta su carné o una constancia de inscripción vigente en una carrera de veterinaria recibe la insignia **Estudiante de veterinaria**.
- **RN-CUI-06** Esa insignia es un plus visible, pero **no** cuenta como certificación ni permite atender mascotas Especiales.
- **RN-CUI-07** Las **certificaciones** se obtienen con un curso avanzado de Pawie y su examen (RN-CUI-08). Los tipos iniciales son:

  | Certificación       | Qué permite                                                                                                                                                                                   |
  | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Cuidado especial ⭐ | Atender mascotas **Especiales** (RN-MAS-06). Es la ⭐ de la v0.4. Sus módulos: protocolos y emergencias, medicamentos, curación de heridas, cuidado geriátrico y recuperación post-operatoria |
  | Primeros auxilios   | Cuenta para subir de nivel                                                                                                                                                                    |
  | Perros grandes      | Cuenta para subir de nivel                                                                                                                                                                    |
  | Gatos               | Cuenta para subir de nivel                                                                                                                                                                    |

- **RN-CUI-08** Para aprobar un curso avanzado hay que sacar al menos **[80%]** en el examen final. El de cuidado especial también exige una demostración práctica, y su contenido lo diseña y valida un veterinario. Los cursos avanzados tienen costo (§18) y son `Fase 2`.
- **RN-CUI-09** Cada certificación dura **[12 meses]** y se renueva con un repaso corto.
- **RN-CUI-10** La ⭐ se suspende o se retira por un incidente grave, por una calificación promedio menor a **[4.0]** en servicios Especiales, o por cancelar cuidados Especiales (RN-CAN-05).
- **RN-CUI-11** En el modelo de datos, cada certificación tiene tipo, fecha de obtención, vencimiento y estado. Los tipos son un catálogo, así que se pueden sumar otros sin cambiar el modelo.
- **RN-CUI-21** El perfil muestra **antes de reservar**: nivel, calificación, cantidad de servicios, insignias (Identidad verificada, Antecedentes verificados, Estudiante de veterinaria) y certificaciones vigentes.

### 4.4 Niveles del cuidador

**En la demo:** todo. Los cuidadores del seed cubren los cuatro niveles.

- **RN-NIV-01** Cada cuidador tiene un **nivel**: **Nuevo**, **Confiable**, **Pro** o **Súper Cuidador**. Lo **calcula el sistema**; el cuidador no lo elige.
- **RN-NIV-02** Requisitos de cada nivel. Un cuidador tiene el nivel más alto cuyos requisitos cumple:

  | Nivel          | Reseñas mínimas | Promedio mínimo | Servicios completados | Certificaciones vigentes                |
  | -------------- | --------------- | --------------- | --------------------- | --------------------------------------- |
  | Nuevo          | —               | —               | —                     | —                                       |
  | Confiable      | [3]             | [4.5]           | —                     | —                                       |
  | Pro            | [3]             | [4.6]           | [15]                  | [2]                                     |
  | Súper Cuidador | [3]             | [4.8]           | [40]                  | [3], una de ellas **Primeros auxilios** |

  Los umbrales son provisionales. `[DEFINIR: validarlos en el piloto]`

- **RN-NIV-03** Todo cuidador que aparece en búsquedas ya tiene identidad y antecedentes verificados (RN-CUI-03), aunque sea Nuevo. **Ajuste al Pricing:** allí "Nuevo" es un perfil recién creado sin verificar; aquí se exige la verificación para cumplir la Promesa de "cuidador verificado" desde el primer servicio.
- **RN-NIV-04** El nivel se recalcula cada vez que cambian sus reseñas, sus servicios completados o sus certificaciones, y puede bajar. Si baja y su precio queda fuera del rango del nuevo nivel, se cobra el extremo más cercano (RN-CUI-17).
- **RN-NIV-05** El cuidador ve su nivel actual y **lo que le falta para el siguiente**, requisito por requisito.
- **RN-NIV-06** Cada reserva guarda el nivel que tenía el cuidador al crearse (RN-PRE-07).

### 4.5 Qué puede y qué no puede hacer un cuidador

- **RN-CUI-12** Solo un cuidador con la ⭐ vigente puede hacer las tareas de cuidado especial (RN-MAS-06), que son de dos grupos:
  - **Clínicas**, siempre con indicaciones escritas del veterinario:
    - Medicación: dar medicamentos orales (pastillas, jarabes) y tópicos (cremas, gotas y limpiezas de ojos y oídos).
    - Curación de heridas y suturas: limpiar con la solución indicada, aplicar crema y cambiar vendajes simples.
    - Recuperación post-operatoria: manejar el collar isabelino o el traje post-operatorio y vigilar la herida, con foto.
    - Alimentación con jeringa sin aguja, con la dieta indicada.
    - Reposo indicado: mantenerla en un espacio reducido.
    - Vigilancia de una condición crónica: registrar apetito, agua, orina, heces, vómitos y señales de dolor.
  - **De asistencia**, con instrucciones escritas del dueño:
    - Ayuda para moverse: levantarla, usar un arnés de soporte o cambiarla de posición.
    - Higiene por incontinencia: pañales y limpieza.
- **RN-CUI-13** **Ningún cuidador** puede:
  - Poner inyecciones de ningún tipo, insulina incluida.
  - Poner sueros.
  - Quitar puntos o drenajes, o poner sondas.
  - Sedar.
  - Cambiar dosis.
  - Diagnosticar o recetar.
- **RN-CUI-14** El dueño siempre entrega el **alimento, los premios, los medicamentos y los insumos**. El cuidador nunca los compra ni los cambia por otros.

### 4.6 Capacidad, precios y reservas

- **RN-CUI-15** Un cuidador no puede tener tramos que se crucen. Cada tramo (un paseo, una visita o una noche, ver §8.1) bloquea solo su propio horario.
- **RN-CUI-16** Si el cuidador activa la **Reserva inmediata**, las solicitudes se confirman sin esperar su aprobación.
- **RN-CUI-17** El cuidador fija su precio para cada servicio **dentro del rango de su nivel** (RN-PRE-01). La app le muestra el precio sugerido como guía. Si no lo cambia, se usa el sugerido. Si su nivel o el rango cambian y su precio queda afuera, se cobra el extremo más cercano del rango vigente.
- **RN-CUI-22** El cuidador puede **compartir su perfil** en Instagram, Facebook o WhatsApp con la hoja de compartir del teléfono. En la demo se comparte un texto con su nivel, su calificación y sus insignias, y el enlace de la landing (`[DEFINIR: URL]`). El perfil público con su propia URL llega con la web. `Fase 2`

## 5. Mascotas

**En la demo:** la ficha completa, el nivel de cuidado y las indicaciones del veterinario.

- **RN-MAS-01** Las especies aceptadas son **perro** y **gato**. Las especies son un catálogo.
- **RN-MAS-02** La **ficha** de la mascota incluye:
  - **Datos:** nombre, especie, raza, fecha de nacimiento (puede ser aproximada), sexo, peso, si está esterilizada y foto.
  - **Rutina:** alimento (marca o tipo y porción), horarios de comida, premios permitidos, rutina diaria y temperamento y notas de manejo.
  - **Salud:** vacunas, veterinario de cabecera, condiciones de salud, medicación con sus horarios y tareas de cuidado (§5.1).
- **RN-MAS-03** Un dueño puede registrar varias mascotas.
- **RN-MAS-11** El dueño puede marcar que su mascota está **en celo**, con fecha de inicio y de fin. No la hace Especial ni cambia el precio; el cuidador lo ve en la solicitud y en la ficha antes de aceptar, y el curso de bienvenida explica cómo atenderla sin aislarla.
- **RN-MAS-12** Durante el servicio, el cuidador ve la ficha completa y las **tareas del tramo**: las comidas y medicinas cuyo horario cae dentro del tramo (RN-EJE-04).

### 5.1 Nivel de cuidado

El nivel de cuidado (**Normal** o **Especial**) ya **no** cambia el precio. Solo decide quién puede atender a la mascota.

- **RN-MAS-04** El nivel de cuidado lo **calcula el sistema** a partir de las respuestas del dueño. El dueño no lo elige.
- **RN-MAS-05** El nivel se calcula **para cada reserva**, según el estado de la mascota en las fechas del servicio.
- **RN-MAS-06** Una mascota es **Especial** si en las fechas de la reserva tiene al menos una tarea de cuidado especial activa (RN-CUI-12). Una reserva con una mascota Especial solo la puede tomar un cuidador con la ⭐ vigente hasta el último día del servicio.
- **RN-MAS-07** La edad, por sí sola, **no** hace Especial a una mascota.
- **RN-MAS-08** Cada tarea se registra con sus fechas de inicio y fin. Una tarea **clínica** exige subir las **indicaciones escritas del veterinario**; una de **asistencia**, las **instrucciones escritas del dueño**. La fecha de fin es opcional para la vigilancia de una condición crónica y para la ayuda para moverse.
- **RN-MAS-09** Si la mascota necesita algo prohibido por RN-CUI-13, el sistema **no permite reservar** mientras esa necesidad esté activa y le explica el motivo al dueño.
- **RN-MAS-10** Si un cuidador descubre una condición que el dueño no declaró, la reporta y la mascota se reclasifica. `Fase 2`

## 6. Servicios

**En la demo:** los tres servicios.

- **RN-SER-01** **Visita a domicilio:** hasta **[60 min]** en la casa del dueño (alimentación, limpieza, compañía y medicación). Se cobra por visita y se pueden agendar varias en un día.
- **RN-SER-02** **Pernocta en casa del dueño:** de **[19:00]** a **[08:00]** del día siguiente, con los cuidados de la noche y de la mañana. Se cobra por noche.
- **RN-SER-03** En estadías de varios días, el dueño puede sumar visitas durante el día. Van como tramos de visita dentro de la misma reserva, al precio de visita del cuidador.
- **RN-SER-05** **Paseo:** **[45 min]** que empiezan y terminan en la dirección del dueño. **Solo para perros**, hasta **[2]** perros por paseo. Se cobra por paseo y se pueden agendar varios en un día. Durante el paseo se registra la ruta (RN-EJE-06).
- **RN-SER-04** Fuera del alcance por ahora: hospedaje en casa del cuidador, guardería de día, baño o grooming y pet taxi (§18).

## 7. Precios y tarifas

**En la demo:** todo lo de esta sección.

- **RN-PRE-01** Rangos y precios sugeridos por **servicio y nivel del cuidador**. Es el precio que fija el cuidador:

  | Servicio | Nuevo                | Confiable            | Pro                  | Súper Cuidador       |
  | -------- | -------------------- | -------------------- | -------------------- | -------------------- |
  | Paseo    | [$3–5], sug. [$4]    | [$5–8], sug. [$6.50] | [$9–14], sug. [$11]  | [$15–22], sug. [$18] |
  | Visita   | [$6–9], sug. [$7]    | [$8–12], sug. [$10]  | [$11–15], sug. [$13] | [$15–20], sug. [$17] |
  | Pernocta | [$15–22], sug. [$18] | [$20–28], sug. [$24] | [$26–35], sug. [$30] | [$32–45], sug. [$38] |

  Los del paseo salen de la encuesta a dueños. Los de visita y pernocta son provisionales. `[DEFINIR: validar visita y pernocta]`

- **RN-PRE-02** Cada mascota adicional en la misma reserva suma **[50%]** del precio del cuidador.
- **RN-PRE-03** El **dueño paga** el precio del cuidador más una **tarifa de servicio de [15%]**, que cubre el pago seguro y la garantía de reembolso.
- **RN-PRE-04** El **cuidador recibe el 100%** de su precio: la **comisión al cuidador es [0%]**. Se mantiene como parámetro por si cambia el modelo.
- **RN-PRE-05** No hay descuentos por repetir con el mismo cuidador.
- **RN-PRE-06** De la tarifa de servicio salen el **IVA ([13%])**, la comisión de la pasarela ([3.5%]) y el **fondo de la garantía ([2%] de lo que paga el dueño)**. El dueño siempre ve el precio final. `[DEFINIR: cómo se aplica el IVA, con un contador]`
- **RN-PRE-07** **Cada reserva guarda una copia** de los precios, las tarifas, el nivel del cuidador y el incentivo vigentes **al crearse**. Si después cambia algo, solo afecta a las reservas nuevas.
- **RN-PRE-08** **Redondeo:** cada monto se redondea una sola vez, al centavo y con la mitad hacia arriba:
  - cada tramo cuesta el precio del cuidador más el recargo por cada mascota adicional (RN-PRE-02);
  - el subtotal es la suma de los tramos;
  - la tarifa de servicio es un porcentaje del subtotal, y el dueño paga el subtotal más la tarifa;
  - la comisión es un porcentaje del subtotal, y el cuidador recibe el subtotal menos la comisión.
- **RN-PRE-09** **Primer servicio sin tarifa:** si el dueño crea una reserva dentro de los **[15 días]** siguientes a su registro y nunca ha pagado una reserva, esa reserva no lleva tarifa de servicio.
  - Solo una reserva activa (`REQUESTED`, `PENDING_PAYMENT` o posterior) puede llevar el beneficio a la vez. Si esa reserva se rechaza, vence o se cancela sin pagarse, el beneficio vuelve a estar disponible mientras siga dentro del plazo.
  - El cuidador cobra igual el 100% y la garantía sigue aplicando.
  - En la app: al registrarse aparece "Tu primer servicio sin tarifa" con los días que quedan, y al pagar la línea de la tarifa aparece tachada en $0.00 con el texto "Primer servicio".
  - La pasarela y el fondo de garantía de ese servicio los absorbe Pawie.
- **RN-PRE-10** El precio que ve el dueño antes de reservar lo calcula la API, nunca la app.

**Ejemplo (paseo con un cuidador Confiable):** el cuidador cobra $6.50. El dueño paga **$7.48** ($6.50 + 15%) y el cuidador recibe **$6.50**. Pawie se queda con $0.98 brutos; después de la pasarela ($0.26) y el fondo de garantía ($0.15) le quedan unos **$0.57** antes del IVA. Si es el primer servicio, el dueño paga $6.50 y Pawie pone unos $0.36.

## 8. Reservas

**En la demo:** búsqueda con filtros, solicitud, aceptación o rechazo, Reserva inmediata, pago, confirmación, ejecución y cierre. Cancelación sin costo antes de pagar (RN-CAN-07).

### 8.1 Búsqueda y solicitud

Una reserva es con un cuidador y un servicio, para una o varias mascotas. Tiene uno o varios **tramos** (cada paseo, cada visita o cada noche) y se paga una sola vez.

- **RN-RES-01** El dueño busca por mascota(s), servicio, fechas y distrito. Solo aparecen los cuidadores aprobados, activos y no pausados que cubren el distrito y tienen disponibilidad. Si la reserva es Especial, solo los que tienen la ⭐ vigente hasta el último día del servicio. Si es un paseo, solo se pueden elegir perros.
- **RN-RES-10** El dueño puede **filtrar** por nivel mínimo, por certificaciones y por calificación mínima. Los resultados se ordenan por calificación y, después, por cantidad de servicios en Pawie.
- **RN-RES-02** El perfil del cuidador muestra lo de RN-CUI-21, sus habilidades declaradas, su descripción, sus precios, sus distritos y si tiene Reserva inmediata.
- **RN-RES-03** Al solicitar, el dueño elige las mascotas (hasta **[3]** por reserva, o [2] perros en un paseo), el servicio, las fechas y horas, y deja **instrucciones para ese servicio** (por ejemplo, un premio o un cambio de horario). Si la reserva es Especial, se adjuntan automáticamente las indicaciones del veterinario del perfil de la mascota.
- **RN-RES-04** Al solicitar, el dueño deja sus **datos de emergencia**: veterinario de cabecera, un contacto de emergencia, un **monto preautorizado para emergencias** y su consentimiento para que lleven a la mascota a una clínica. Sin ese consentimiento no se puede reservar. El monto solo se declara: no se cobra al reservar.
- **RN-RES-05** Una solicitud debe hacerse con al menos **[2 h]** de anticipación al inicio del servicio.
- **RN-RES-11** El cuidador ve en cada solicitud: las mascotas con su ficha, si alguna está en celo o es Especial, el servicio, las fechas y horas, el distrito (no la dirección exacta, RN-CTA-04) y **lo que va a ganar**. Acepta o rechaza desde la app.

### 8.2 Estados de una reserva

| Estado                                           | Cuándo se entra                                                                         | En la demo     |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- | -------------- |
| `SOLICITADA`                                     | El dueño solicita a un cuidador sin Reserva inmediata                                   | Sí             |
| `PENDIENTE_DE_PAGO`                              | El cuidador acepta, o el dueño solicita a un cuidador con Reserva inmediata             | Sí             |
| `CONFIRMADA`                                     | La pasarela aprueba el pago (webhook), también uno tarde (RN-PAG-06)                    | Sí             |
| `EN_CURSO`                                       | El cuidador hace check-in en el primer tramo (RN-EJE-01)                                | Sí             |
| `FINALIZADA`                                     | El cuidador hace check-out en el último tramo (RN-EJE-03)                               | Sí             |
| `CERRADA`                                        | Pasan [48 h] desde el check-out sin reclamo y se libera el pago al cuidador (RN-PAG-03) | Sí             |
| `RECHAZADA`                                      | El cuidador rechaza la solicitud                                                        | Sí             |
| `EXPIRADA`                                       | El cuidador no responde a tiempo (RN-RES-06), o el dueño no paga a tiempo (RN-RES-07)   | Sí             |
| `CANCELADA_POR_DUENO` / `CANCELADA_POR_CUIDADOR` | Cancelación (§10)                                                                       | Solo RN-CAN-07 |
| `EN_DISPUTA`                                     | El dueño abre un reclamo de garantía durante la retención del pago (RN-GAR-02)          | Sí             |

- **RN-RES-06** El cuidador tiene un plazo para responder que depende de cuánto falta para el servicio cuando el dueño solicita: **[24 h]** si faltan más de 72 h, **[6 h]** si faltan entre 24 y 72 h (con exactamente 72 h o 24 h también), y **[1 h]** si faltan menos de 24 h. Si el servicio empieza antes, el plazo vence al inicio del primer tramo.
- **RN-RES-07** Desde que la reserva pasa a `PENDIENTE_DE_PAGO`, el dueño tiene **[2 h]** para pagar. Si el servicio empieza antes, el plazo vence al inicio del primer tramo.
- **RN-RES-08** La primera reserva Especial con un cuidador nuevo exige un **encuentro previo** después del pago. `Fase 2`
- **RN-RES-09** **Solicitud abierta** para urgencias, que toma el primer cuidador que acepte. `Fase 2`

## 9. Pagos

**En la demo:** cobro con Wompi en modo de prueba (RN-PAG-01, RN-PAG-02 y RN-PAG-05 a RN-PAG-08) y pago al cuidador simulado (RN-PAG-03).

- **RN-PAG-01** La pasarela es **Wompi** (Banco Agrícola), con una comisión de [3.5%] por transacción. En la demo se usan transacciones de prueba (`esReal = false`).
- **RN-PAG-02** El dueño paga el **total** para confirmar la reserva. Un pago cuenta como aprobado solo cuando llega el webhook de Wompi, no cuando el usuario vuelve a la app.
- **RN-PAG-03** Pawie retiene el dinero y le paga al cuidador **[48 h]** después del check-out si no hay un reclamo abierto. El cuidador recibe su subtotal menos la comisión ([0%]). En la demo el pago se registra como **simulado**.
- **RN-PAG-04** En estadías largas, el pago al cuidador se libera por semanas completadas. `Fase 2`
- **RN-PAG-05** Los reembolsos se hacen por el mismo medio de pago. La API de Wompi no tiene endpoint de reembolso, así que se hacen desde el panel de Wompi y un administrador los registra en Pawie con un script. Mientras tanto, el pago queda **por reembolsar**.
- **RN-PAG-06** Si el pago se aprueba cuando la reserva ya venció, la reserva **se confirma si el horario sigue libre**. Si no, sigue vencida y el pago se reembolsa.
- **RN-PAG-07** Una reserva se paga una sola vez. Un **segundo pago aprobado** se reembolsa, y también el de una reserva que el dueño **ya canceló**.
- **RN-PAG-08** El dueño paga en un **enlace de pago** de Wompi que acepta un solo pago y vence con el plazo de pago (RN-RES-07).
- **RN-PAG-09** **Pago por transferencia:** el 44% de los dueños lo prefiere. `[DEFINIR: cómo se recibe y cómo se confirma]`. `Fase 2`
- **RN-PAG-10** El cuidador ve sus **ganancias**: por cobrar (reservas confirmadas o en retención), pagadas y el total del mes.

## 10. Cancelaciones

**En la demo:** solo la cancelación sin costo antes de pagar (RN-CAN-07). Lo demás es Fase 2; mientras tanto, la garantía (§14) cubre al dueño si el cuidador no se presenta o cancela.

- **RN-CAN-01** Si el dueño cancela una reserva ya pagada, la devolución depende de cuánto falta para el inicio: más de **[48 h]**, 100%; entre **[24 y 48 h]**, **[50%]**; menos de **[24 h]**, nada. `Fase 2`
- **RN-CAN-02** El dinero que no se devuelve se reparte en las mismas proporciones que una reserva normal. `Fase 2`
- **RN-CAN-03** Si la mascota está hospitalizada o murió y hay una constancia, se devuelve el 100% sin importar el plazo. `Fase 2`
- **RN-CAN-04** Si el servicio ya empezó, no se devuelve nada por el tiempo restante, salvo por la garantía. `Fase 2`
- **RN-CAN-05** Si cancela el cuidador, queda en su historial. Con **[3] cancelaciones en [90] días** se suspende por **[15 días]**. Si cancela un cuidado Especial con menos de 48 h, se le suspende la ⭐ por **[30 días]**. `Fase 2`
- **RN-CAN-06** Cuando cancela el cuidador, Pawie busca un reemplazo con prioridad. Si no lo consigue, devuelve el 100% al dueño y le da un crédito del **[10%]**. `Fase 2`
- **RN-CAN-07** Mientras la reserva está `SOLICITADA` o `PENDIENTE_DE_PAGO`, el dueño puede cancelarla sin costo. Pasa a `CANCELADA_POR_DUENO` y libera el horario del cuidador. Si después llega un pago aprobado, se reembolsa (RN-PAG-07).

## 11. Ejecución del servicio

**En la demo:** todo, salvo el reemplazo de RN-EJE-02 y el aviso de dosis no registradas.

- **RN-EJE-01** El cuidador hace **check-in** al empezar cada tramo, y se registran la hora y la ubicación. El primer check-in pasa la reserva a `EN_CURSO`.
- **RN-EJE-02** Si no hay check-in **[30 min]** después de la hora de inicio, se avisa al dueño y al equipo, y el dueño puede reclamar la garantía. Buscar un reemplazo es `Fase 2`.
- **RN-EJE-03** Cada tramo necesita al menos **[1] foto** antes del **check-out**, que también registra hora y ubicación. El check-out del último tramo pasa la reserva a `FINALIZADA`.
- **RN-EJE-04** **Tareas del tramo:** la app arma una lista con las comidas y medicinas de la ficha cuyo horario cae dentro del tramo, y las tareas de cuidado especial activas. El cuidador marca cada una con su hora y una nota opcional. Avisar al dueño de una dosis no registrada es `Fase 2`.
- **RN-EJE-05** La **bitácora** (check-in, tareas, fotos, ruta y check-out) queda en el historial de la mascota. El dueño la ve en el detalle de la reserva.
- **RN-EJE-06** **Ruta del paseo:** entre el check-in y el check-out de un paseo, la app del cuidador registra la ubicación cada **[15 s]**. El dueño ve la ruta en un mapa que se actualiza mientras ocurre: Google Maps en Android y Apple Maps en iPhone.
  - En la demo la ruta se registra **con la app abierta** en primer plano. Registrarla en segundo plano es `Fase 2`.
- **RN-EJE-07** El dueño ve el estado del servicio en una sola pantalla: estado, tareas hechas, fotos y, en un paseo, la ruta.

## 12. Emergencias

**En la demo:** se capturan los datos de emergencia (RN-RES-04) y el asistente responde las emergencias de salud (RN-SOP-06). El resto es `Fase 2`.

- **RN-EME-01** El cuidador tiene un **botón de emergencia** que avisa al dueño y a Pawie, muestra las clínicas 24 h cercanas y registra un incidente. `Fase 2`
- **RN-EME-02** Ante una **señal de alarma**, el cuidador va a la clínica de inmediato y avisa al mismo tiempo. Las señales de alarma son:
  - Dificultad para respirar.
  - Convulsiones.
  - Sangrado que no para.
  - Posible intoxicación.
  - Desmayo, o que no pueda levantarse.
  - En un perro, abdomen hinchado y duro con arcadas sin poder vomitar.
  - En un gato, esfuerzo para orinar sin lograrlo.
  - Herida quirúrgica abierta.
  - Golpe de calor.
- **RN-EME-03** Si no hay señales de alarma, el cuidador primero contacta al dueño. Si no responde en **[10 min]**, contacta al veterinario de cabecera.
- **RN-EME-04** El cuidador **nunca pone dinero de su bolsillo**. Pawie le paga a la clínica hasta el monto preautorizado y después le cobra al dueño con un enlace de pago. `Fase 2`
- **RN-EME-05** Si la mascota muere durante un servicio, se avisa de inmediato al dueño, el administrador revisa la bitácora y el incidente, y el cuidador no recibe sanción si siguió el protocolo. `Fase 2`

## 13. Reseñas y reputación

**En la demo:** el dueño califica al cuidador.

- **RN-RSE-01** El dueño puede calificar al cuidador de 1 a 5 estrellas, con un comentario opcional, después de una reserva `FINALIZADA` y dentro de **[7 días]**. Una reseña por reserva.
- **RN-RSE-02** Reseñas del cuidador al dueño, publicadas a la vez para que nadie vea la del otro antes de escribir la suya. `Fase 2`
- **RN-RSE-03** Si un cuidador tiene un promedio menor a **[4.0]** después de **[5]** servicios, lo revisa un administrador. `Fase 2`
- **RN-RSE-04** El cuidador ve las reseñas del dueño antes de aceptar. `Fase 2`
- **RN-RSE-05** Las reseñas, el nivel, las certificaciones y la cantidad de servicios solo cuentan con servicios hechos en Pawie.
- **RN-RSE-06** Cada reseña nueva recalcula el nivel del cuidador (RN-NIV-04).

## 14. Garantía de reembolso

**En la demo:** el reclamo y su estado. Lo resuelve el equipo y el reembolso se registra con un script.

- **RN-GAR-01** La **garantía de reembolso** viene incluida en cada reserva pagada en Pawie y devuelve el **100% de lo que pagó el dueño** cuando:
  - el cuidador no se presenta (RN-EJE-02);
  - el cuidador cancela a último momento, con menos de **[24 h]** de anticipación;
  - el servicio no se completa: falta el check-out, las fotos o, en un paseo, la ruta;
  - hay un incidente comprobado.
- **RN-GAR-02** El dueño reclama desde el detalle de la reserva o desde el asistente, hasta **[48 h]** después del check-out del último tramo, o de la hora de inicio si no hubo check-in. El reclamo crea un caso de soporte (RN-SOP-04) y pasa la reserva a `EN_DISPUTA`, lo que congela el pago al cuidador.
- **RN-GAR-03** El equipo resuelve con la bitácora, las fotos y la ruta como prueba, en **[5 días hábiles]**. Si procede, el pago queda **por reembolsar** (RN-PAG-05) y el cuidador no recibe ese pago. Si no procede, la reserva pasa a `CERRADA` y se libera el pago.
- **RN-GAR-04** La garantía se paga con el fondo de RN-PRE-06. No cubre el avance de una enfermedad que la mascota ya tenía. La cobertura de daños, con tope por evento, es `Fase 2`. `[DEFINIR: tope por evento]`

## 15. Parámetros configurables

Se guardan en la base de datos, no en el código (`src/settings/settings.registry.ts`). En la demo se cambian con un script o con el seed. Cambiarlos no afecta las reservas ya creadas (RN-PRE-07).

| Parámetro                                            | Valor inicial                       | Regla                |
| ---------------------------------------------------- | ----------------------------------- | -------------------- |
| Tarifa de servicio al dueño                          | 15%                                 | RN-PRE-03            |
| Comisión al cuidador                                 | 0%                                  | RN-PRE-04            |
| Recargo por mascota adicional                        | 50%                                 | RN-PRE-02            |
| Rangos y precios sugeridos por servicio y nivel      | Ver tabla de RN-PRE-01              | RN-PRE-01            |
| Días para usar el primer servicio sin tarifa         | 15 días                             | RN-PRE-09            |
| Fondo de la garantía                                 | 2%                                  | RN-PRE-06            |
| IVA                                                  | 13%                                 | RN-PRE-06            |
| Comisión de la pasarela                              | 3.5%                                | RN-PAG-01            |
| Requisitos de cada nivel                             | Ver tabla de RN-NIV-02              | RN-NIV-02            |
| Duración del paseo                                   | 45 min                              | RN-SER-05            |
| Máximo de perros por paseo                           | 2                                   | RN-SER-05            |
| Duración máxima de una visita                        | 60 min                              | RN-SER-01            |
| Horario de pernocta                                  | 19:00–08:00                         | RN-SER-02            |
| Máximo de mascotas por reserva                       | 3                                   | RN-RES-03            |
| Anticipación mínima para solicitar                   | 2 h                                 | RN-RES-05            |
| Plazo de respuesta del cuidador                      | 24 h / 6 h / 1 h                    | RN-RES-06            |
| Plazo de pago                                        | 2 h                                 | RN-RES-07            |
| Retención del pago y plazo del reclamo               | 48 h                                | RN-PAG-03, RN-GAR-02 |
| Anticipación que cuenta como "último momento"        | 24 h                                | RN-GAR-01            |
| Plazo para resolver un reclamo                       | 5 días hábiles                      | RN-GAR-03            |
| Tolerancia de check-in                               | 30 min                              | RN-EJE-02            |
| Fotos mínimas por tramo                              | 1                                   | RN-EJE-03            |
| Intervalo de la ruta del paseo                       | 15 s                                | RN-EJE-06            |
| Plazo para escribir una reseña                       | 7 días                              | RN-RSE-01            |
| Nota mínima de los cursos                            | 80%                                 | RN-CUI-02, RN-CUI-08 |
| Vigencia de una certificación                        | 12 meses                            | RN-CUI-09            |
| Calificación mínima para conservar la ⭐             | 4.0 en servicios Especiales         | RN-CUI-10            |
| Horario de atención del equipo                       | Todos los días, 07:00–21:00         | RN-SOP-03            |
| Ventanas de cancelación del dueño                    | 48 h y 24 h; 100% / 50% / 0%        | RN-CAN-01            |
| Cancelaciones del cuidador antes de suspender        | 3 en 90 días; suspensión de 15 días | RN-CAN-05            |
| Suspensión de la ⭐ por cancelar un cuidado Especial | 30 días                             | RN-CAN-05            |
| Crédito al dueño si no hay reemplazo                 | 10%                                 | RN-CAN-06            |
| Espera al dueño en emergencias sin señales de alarma | 10 min                              | RN-EME-03            |
| Umbral de revisión por calificación                  | 4.0 después de 5 servicios          | RN-RSE-03            |

## 16. Avisos, calendario y fidelización

**En la demo:** notificaciones push y agregar al calendario.

- **RN-NOT-01** Notificaciones push al **dueño**: el cuidador aceptó o rechazó, la reserva quedó confirmada, el cuidador hizo check-in, hay una foto nueva, el cuidador hizo check-out y el reclamo cambió de estado.
- **RN-NOT-02** Notificaciones push al **cuidador**: solicitud nueva, reserva pagada y confirmada, y reserva cancelada por el dueño.
- **RN-NOT-03** Si el usuario no da permiso de notificaciones, la app funciona igual: la información está en sus pantallas.
- **RN-CAL-01** En una reserva confirmada, el dueño y el cuidador pueden **agregarla al calendario** del teléfono, con un evento por tramo, la dirección para el cuidador y el distrito para el dueño.
- **RN-FID-02** La garantía, el historial de cuidado, las reseñas y el nivel **solo existen en reservas hechas en Pawie**.
- **RN-FID-03** Pawie entrega a los cuidadores una **constancia de horas de experiencia**. `Fase 2`
- **RN-FID-04** Mientras no haya una reserva confirmada, el chat interno filtra teléfonos, correos y redes sociales. `Fase 2`

## 17. Soporte y asistente virtual

**En la demo:** todo.

- **RN-SOP-01** El soporte tiene dos niveles, en español:
  - **Nivel 1, asistente virtual en la app:** dudas de uso, reservas, pagos, garantía, registro, cursos, niveles y precios.
  - **Nivel 2, equipo de Pawie:** lo que el asistente no resuelve, los reclamos de garantía y cualquier problema durante un servicio.
- **RN-SOP-02** El asistente es de **opciones guiadas**: un árbol de preguntas y respuestas escrito por el equipo. **No usa IA generativa** y nunca responde algo que el equipo no escribió. El contenido vive en la base de datos, separado para dueños y para cuidadores, y se actualiza sin publicar una versión nueva de la app. El **centro de ayuda** es el mismo contenido, navegable como preguntas frecuentes.
- **RN-SOP-03** Cuando hace falta una persona:
  - **dentro del horario de atención** ([07:00–21:00], hora de El Salvador), el asistente crea un caso y abre **WhatsApp Business** (`[DEFINIR: número]`) con un mensaje que trae el número de caso;
  - **fuera de horario**, crea el caso, avisa al equipo por correo y le dice al usuario que lo atienden a primera hora.
- **RN-SOP-04** Cada caso tiene número, usuario, la reserva si aplica, el tipo (duda, problema durante un servicio o reclamo de garantía), las opciones que recorrió en el asistente y su estado.
- **RN-SOP-05** Respuesta del equipo: menos de **30 min** durante un servicio en curso y el mismo día para lo demás. Es un compromiso operativo, no lo mide el sistema en la demo.
- **RN-SOP-06** **Emergencias de salud:** el asistente no las atiende. Al dueño le indica llamar de inmediato a su veterinario de cabecera, con su teléfono de la ficha. Al cuidador, llamar al dueño y seguir RN-EME-02 si hay una señal de alarma.
- **RN-SOP-07** Los videos cortos en Instagram y TikTok son parte del soporte, pero no del producto.

## 18. Ideas para después

- **Hospedaje en casa del cuidador**, con el filtro de espacio disponible (casa con patio, sin jaulas) que pide el Vehículo. Es el siguiente segmento del Buyer: dueños que viajan.
- Guardería de día, baño o grooming y pet taxi.
- **Cursos avanzados de pago** (primeros auxilios, perros grandes, gatos y cuidado especial), con el **50% de descuento en el primero** para los primeros [10] cuidadores que verifiquen su identidad y terminen el curso de bienvenida en [15 días].
- Bono por referir y Cuidador del mes.
- Certificación "Inyectables" (insulina, sueros).
- Animales exóticos, cada uno con su propia certificación.
- Plan Protección Pawie: una suscripción de seguro o asistencia contratada con un socio.
- Paquetes prepagados, bonos de temporada alta y convenios con clínicas veterinarias.

## 19. Pendientes por validar

| Tema                            | Qué validar                                                  | Con quién                   |
| ------------------------------- | ------------------------------------------------------------ | --------------------------- |
| Precios                         | Los rangos de visita y pernocta por nivel (RN-PRE-01)        | Unos 10 dueños y cuidadores |
| Niveles                         | Los umbrales de RN-NIV-02                                    | Piloto                      |
| Transferencia                   | Cómo recibir y confirmar pagos por transferencia (RN-PAG-09) | Wompi y banco               |
| WhatsApp                        | Número de WhatsApp Business del equipo (RN-SOP-03)           | Equipo                      |
| Compartir perfil                | URL que se comparte mientras no existe la web (RN-CUI-22)    | Equipo                      |
| Laboral                         | Que los cuidadores no se consideren empleados                | Abogado                     |
| Ejercicio profesional           | Qué puede hacer legalmente un estudiante sin licencia        | Abogado y veterinario       |
| Fondos de terceros              | Si Pawie puede retener el dinero de los cuidadores           | Abogado                     |
| Impuestos                       | Cómo se aplica el IVA a la tarifa y cómo se factura          | Contador                    |
| Datos personales                | Cómo guardar DUI, antecedentes, direcciones y ubicaciones    | Abogado                     |
| Verificación                    | Qué documentos de antecedentes se exigirán (RN-CUI-01)       | Abogado                     |
| Wompi                           | Cómo pagar a los cuidadores                                  | Wompi                       |
| Garantía                        | Tope por evento de la cobertura de daños (RN-GAR-04)         | Equipo y una aseguradora    |
| Seguro de responsabilidad civil | Costo de cubrir mordeduras y daños                           | Aseguradora                 |
