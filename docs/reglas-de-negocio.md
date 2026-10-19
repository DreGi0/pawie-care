# Pawie Care: reglas de negocio

**Versión:** 0.4 · **Fecha:** 2026-10-18 · **Estado:** borrador aprobado para empezar el backend

## Cómo leer este documento

- Cada regla tiene un ID (`RN-XXX-00`) para poder citarla en el código, los tests y los tickets.
- Los valores entre corchetes, como **[15%]**, son **parámetros configurables**. Están todos en la [sección 15](#15-parámetros-configurables).
- Cada sección empieza con una línea **En la demo** que dice qué parte se construye ahora. Lo que no se menciona ahí es Fase 2. Aun así, el modelo de datos debería contemplarlo para no rehacerlo después.

---

## 1. Contexto

- Pawie es un marketplace que conecta **dueños de mascotas** con **cuidadores** en el Área Metropolitana de San Salvador (AMSS), El Salvador. Los precios están en **dólares (USD)**.
- Atiende perros y gatos. Lo que la diferencia es el **cuidado especial** (mascotas mayores, recién operadas o con condiciones de salud), que solo pueden dar cuidadores certificados con la **⭐**.
- Los cuidadores pueden ser estudiantes o practicantes de veterinaria, o cualquier persona que quiera un ingreso extra y pase la verificación.
- **Pawie no es un servicio veterinario.** Los cuidadores no diagnostican ni recetan; solo siguen indicaciones escritas del veterinario de la mascota.

## 2. Alcance de la demo

La demo es una **app móvil** (iOS y Android); la versión web viene después. Cubre el **flujo completo del dueño**:

1. Registrarse e iniciar sesión.
2. Registrar una o varias mascotas.
3. Buscar cuidadores y ver sus perfiles, distinguiendo a los que tienen ⭐ y a los estudiantes de veterinaria.
4. Agendar y contratar un servicio, con pago real en modo de prueba (Wompi).

Lo que la demo resuelve de otra forma:

- **Cuidadores:** vienen precargados como datos de prueba, ya verificados y con _Reserva inmediata_ activada. No hay panel de cuidador.
- **Aceptación del cuidador:** después de solicitar, el frontend muestra una animación de unos 5 segundos ("Buscando… / El cuidador aceptó") que imita la aceptación del flujo real.
- **Parámetros (precios, comisiones, plazos):** se guardan en la base de datos y se cambian con un script o un seed. El panel de administración para editarlos es Fase 2.
- **Calificaciones de los cuidadores:** son datos de prueba. Escribir reseñas es Fase 2.

**Fuera de la demo:** registro y verificación de cuidadores, panel de cuidador, check-in y bitácora, emergencias, reseñas, disputas, pagos a cuidadores, panel de administración y seguro de mascotas.

---

## 3. Cuentas y roles

**En la demo:** registro e inicio de sesión del dueño. Los cuidadores son datos de prueba.

- **RN-CTA-01** Hay tres roles: **dueño**, **cuidador** y **administrador**. Una misma cuenta puede ser dueño y cuidador a la vez.
- **RN-CTA-02** Solo pueden registrarse mayores de 18 años.
- **RN-CTA-03** El dueño debe verificar su identidad (DUI) antes de su primera **pernocta**, para proteger al cuidador que entra a su casa. `Fase 2`
- **RN-CTA-04** El teléfono del cuidador y la dirección del dueño quedan ocultos hasta que existe una reserva confirmada entre los dos.
- **RN-CTA-05** El administrador aprueba cuidadores, resuelve disputas y edita los parámetros. `Fase 2`

## 4. Cuidadores

**En la demo:** perfiles precargados que muestran la ⭐, la insignia de estudiante, la calificación, la cantidad de servicios, los precios, los distritos que cubren y si tienen Reserva inmediata.

### 4.1 Alta y verificación `Fase 2`

- **RN-CUI-01** Para darse de alta, el cuidador entrega su DUI, una selfie de verificación, su **solvencia de la PNC** y su **constancia de antecedentes penales**. Falta confirmar qué documentos se exigirán exactamente.
- **RN-CUI-02** Antes de aparecer en búsquedas debe aprobar una **capacitación básica obligatoria**: reglas de la plataforma, manejo de perros y gatos, y primeros auxilios básicos.
- **RN-CUI-03** Un administrador aprueba cada alta. Solo los cuidadores aprobados aparecen en búsquedas.
- **RN-CUI-04** El cuidador elige los **distritos** que cubre (los antiguos municipios del AMSS, como San Salvador, Antiguo Cuscatlán, Santa Tecla o Mejicanos) y mantiene su calendario de disponibilidad.

### 4.2 Insignia "Estudiante de veterinaria"

- **RN-CUI-05** El cuidador que presenta su carné o una constancia de inscripción vigente en una carrera de veterinaria recibe la insignia **Estudiante de veterinaria** en su perfil.
- **RN-CUI-06** La insignia es un plus visible para el dueño, pero **no da la ⭐** ni permite tomar cuidados especiales.

### 4.3 Certificación ⭐ de cuidado especial

- **RN-CUI-07** La ⭐ se obtiene **solo** completando el curso de cuidado especial de Pawie, que dura una semana y es igual para todos, estudiantes incluidos. Sus módulos son:
  1. Protocolos de Pawie y emergencias
  2. Administración de medicamentos en perros y gatos
  3. Curación de heridas y suturas
  4. Cuidado geriátrico y movilidad
  5. Recuperación post-operatoria y señales de alarma
- **RN-CUI-08** Para aprobar hay que sacar al menos **[80%]** en el examen final y hacer una demostración práctica. El contenido lo diseña y valida un veterinario.
- **RN-CUI-09** La ⭐ dura **[12 meses]** y se renueva con un repaso corto.
- **RN-CUI-10** La ⭐ se suspende o se retira por un incidente grave, por una calificación promedio menor a **[4.0]** en servicios especiales, o por cancelar cuidados especiales (ver RN-CAN-05).
- **RN-CUI-11** En el modelo de datos, la ⭐ es una **certificación** con tipo, fecha de obtención, vencimiento y estado. En la demo hay un solo tipo ("Cuidado especial"), pero así se pueden sumar otros más adelante, como "Inyectables".

### 4.4 Qué puede y qué no puede hacer un cuidador

- **RN-CUI-12** Un cuidador **⭐** puede hacer las tareas de cuidado especial (RN-MAS-06), que son de dos grupos:
  - **Clínicas**, siempre con indicaciones escritas del veterinario:
    - Medicación: dar medicamentos orales (pastillas, jarabes) y tópicos (cremas, gotas y limpiezas de ojos y oídos).
    - Curación de heridas y suturas: limpiar con la solución indicada, aplicar crema y cambiar vendajes simples.
    - Recuperación post-operatoria: manejar el collar isabelino o el traje post-operatorio para que la mascota no se lama, y vigilar el estado de la herida, con foto.
    - Alimentación con jeringa sin aguja, con la dieta o la comida blanda indicada.
    - Reposo indicado: mantenerla en un espacio reducido.
    - Vigilancia de una condición crónica: registrar apetito, agua, orina, heces, vómitos y señales de dolor.
  - **De asistencia**, con instrucciones escritas del dueño:
    - Ayuda para moverse: levantarla, usar un arnés de soporte o cambiarla de posición si no se mueve.
    - Higiene por incontinencia: pañales y limpieza.
- **RN-CUI-13** **Ningún cuidador** puede:
  - Poner inyecciones de ningún tipo, insulina incluida.
  - Poner sueros.
  - Quitar puntos o drenajes, o poner sondas.
  - Sedar.
  - Cambiar dosis.
  - Diagnosticar o recetar.
- **RN-CUI-14** El dueño siempre pone los medicamentos e insumos. El cuidador nunca los compra ni los consigue.

### 4.5 Capacidad y reservas

- **RN-CUI-15** Un cuidador no puede tener tramos que se crucen. Cada tramo (una visita o una noche, ver sección 8.1) bloquea solo su propio horario, sea una pernocta normal o especial.
- **RN-CUI-16** Si el cuidador activa la **Reserva inmediata**, las solicitudes se confirman sin esperar su aprobación.
- **RN-CUI-17** El cuidador fija su precio para cada servicio y nivel **dentro del rango** que define Pawie (ver sección 7). Si no lo cambia, se usa el precio sugerido. Si el rango cambia y su precio queda afuera, se cobra el extremo más cercano del rango vigente.

## 5. Mascotas

**En la demo:** registro de mascotas con su perfil, la clasificación Normal o Especial, y la carga de las indicaciones del veterinario.

- **RN-MAS-01** Las especies aceptadas son **perro** y **gato**. Las especies son un catálogo, así que se pueden agregar otras después sin cambiar el modelo.
- **RN-MAS-02** El perfil de la mascota incluye: nombre, especie, raza, fecha de nacimiento (puede ser aproximada), sexo, peso, si está esterilizada, vacunas, foto, temperamento y notas de manejo, veterinario de cabecera, condiciones de salud y medicación.
- **RN-MAS-03** Un dueño puede registrar varias mascotas.

### 5.1 Nivel de cuidado

- **RN-MAS-04** El nivel de cuidado (**Normal** o **Especial**) lo **calcula el sistema** a partir de las respuestas del dueño. El dueño no lo elige, para que nadie lo baje para pagar menos.
- **RN-MAS-05** El nivel se calcula **para cada reserva**, según el estado de la mascota en las fechas del servicio. Por ejemplo, una recuperación post-operatoria deja de contar cuando pasa su fecha de fin.
- **RN-MAS-06** Una mascota es **Especial** si en las fechas de la reserva tiene al menos una tarea de cuidado especial activa. Las tareas son de dos grupos:
  - **Clínicas:** medicación que el cuidador debe dar, curación de heridas o suturas, recuperación post-operatoria, alimentación con jeringa, reposo indicado y vigilancia de una condición crónica.
  - **De asistencia:** ayuda para moverse e higiene por incontinencia.
- **RN-MAS-07** La edad, por sí sola, **no** hace Especial a una mascota. Una mascota mayor y sana es Normal.
- **RN-MAS-08** Cada tarea se registra con sus fechas de inicio y fin. Para una tarea **clínica**, el dueño debe subir las **indicaciones escritas del veterinario** (receta o instrucciones post-operatorias); para una de **asistencia** bastan las **instrucciones escritas del dueño**. La fecha de fin es opcional para la vigilancia de una condición crónica y para la ayuda para moverse.
- **RN-MAS-09** Si la mascota necesita algo prohibido por RN-CUI-13 (por ejemplo, insulina o sueros), el sistema **no permite reservar** mientras esa necesidad esté activa y le explica el motivo al dueño. Estas necesidades no piden indicaciones ni instrucciones, y su fecha de fin es opcional: sin ella, la mascota no se puede reservar hasta que el dueño la cierre.
- **RN-MAS-10** Si un cuidador descubre una condición que el dueño no declaró, la reporta. La mascota se reclasifica y se le cobra al dueño la diferencia; si se repite, hay sanción. Si el cuidador no tiene ⭐, Pawie decide si continúa o se busca un reemplazo. `Fase 2`

## 6. Servicios

**En la demo:** los dos servicios.

- **RN-SER-01** **Visita a domicilio:** hasta **[60 min]** en la casa del dueño (alimentación, limpieza, compañía, medicación y, si es un perro, una caminata corta). Se cobra por visita y se pueden agendar varias en un día. Cada visita ocupa los [60 min] completos en el calendario del cuidador, sin tiempo aparte para el traslado.
- **RN-SER-02** **Pernocta en casa del dueño:** el cuidador duerme en la casa, de **[19:00]** a **[08:00]** del día siguiente, e incluye los cuidados de la noche y de la mañana. Se cobra por noche.
- **RN-SER-03** En estadías de varios días, la mascota queda sola entre las 08:00 y las 19:00, así que el dueño puede sumar visitas durante el día. Van como tramos de visita dentro de la misma reserva, al precio de visita del nivel de la reserva.
- **RN-SER-04** Fuera del alcance por ahora: paseos sueltos y hospedaje en la casa del cuidador.

## 7. Precios y comisiones

**En la demo:** todo lo de esta sección.

- **RN-PRE-01** Rangos y precios sugeridos. Es el precio que fija el cuidador, antes de comisiones:

  | Servicio | Nivel    | Rango    | Sugerido |
  | -------- | -------- | -------- | -------- |
  | Visita   | Normal   | [$10–14] | [$12]    |
  | Visita   | Especial | [$15–20] | [$17]    |
  | Pernocta | Normal   | [$20–30] | [$25]    |
  | Pernocta | Especial | [$30–45] | [$35]    |

- **RN-PRE-02** Cada mascota adicional en la misma reserva suma **[50%]** del precio del cuidador. Si una sola de las mascotas es Especial, toda la reserva se cobra al precio Especial y requiere un cuidador ⭐.
- **RN-PRE-03** El **dueño paga** el precio del cuidador más una **tarifa de servicio de [10%]**.
- **RN-PRE-04** El **cuidador recibe** su precio menos una **comisión de [15%]**.
- **RN-PRE-05** No hay descuentos por repetir con el mismo cuidador. La comisión es igual para todas las reservas.
- **RN-PRE-06** De lo que se queda Pawie salen el **IVA ([13%])**, la comisión de la pasarela de pagos y el **fondo de la Garantía Pawie ([2%] de lo que paga el dueño)**. El dueño siempre ve el precio final. Falta validar con un contador cómo se aplica el IVA.
- **RN-PRE-07** **Cada reserva guarda una copia** de los precios, comisiones y porcentajes vigentes **al crearse**, es decir, cuando el dueño la solicita. Si después cambia un parámetro, solo afecta a las reservas nuevas. Así el dueño paga lo que vio al reservar, aunque el cuidador tarde en aceptar.
- **RN-PRE-08** **Redondeo:** cada monto se redondea una sola vez, al centavo y con la mitad hacia arriba:
  - cada tramo cuesta el precio del cuidador más el recargo por cada mascota adicional (RN-PRE-02);
  - el subtotal es la suma de los tramos;
  - la tarifa de servicio es un porcentaje del subtotal, y el dueño paga el subtotal más la tarifa;
  - la comisión es un porcentaje del subtotal, y **el cuidador recibe el subtotal menos la comisión**.

**Ejemplo (visita especial):** el cuidador cobra $17. El dueño paga **$18.70** ($17 + 10%) y el cuidador recibe **$14.45** ($17 − 15%). Pawie se queda con $4.25 brutos; después de IVA, pasarela y fondo de garantía le quedan unos **$2.65**.

## 8. Reservas

**En la demo:** búsqueda, solicitud, Reserva inmediata, pago y confirmación (RN-RES-01 a RN-RES-07), y la cancelación sin costo antes de pagar (RN-CAN-07).

### 8.1 Búsqueda y solicitud

Una reserva es con un cuidador y un servicio, para una o varias mascotas. Tiene uno o varios **tramos**, que son cada visita o cada noche, y se paga una sola vez.

- **RN-RES-01** El dueño busca por mascota(s), servicio, fechas y distrito. Solo aparecen los cuidadores que están aprobados y activos, cubren el distrito, tienen disponibilidad en esas fechas y, si la reserva es Especial, tienen la ⭐ vigente hasta el último día del servicio. Los resultados se ordenan por calificación y, después, por la cantidad de servicios en Pawie.
- **RN-RES-02** El perfil del cuidador muestra la ⭐, la insignia de estudiante, la calificación, la cantidad de servicios en Pawie, los precios, los distritos y si tiene Reserva inmediata.
- **RN-RES-03** Al solicitar, el dueño elige las mascotas (hasta **[3]** por reserva), el servicio, las fechas y horas, y deja instrucciones. Si la reserva es Especial, se adjuntan automáticamente las indicaciones del veterinario que están en el perfil de la mascota.
- **RN-RES-04** Al solicitar, el dueño también deja sus **datos de emergencia**: veterinario de cabecera, un contacto de emergencia, un **monto preautorizado para emergencias** y su consentimiento para que lleven a la mascota a una clínica. Sin ese consentimiento no se puede reservar, porque ante una señal de alarma el cuidador tiene que ir a la clínica de inmediato (RN-EME-02). El monto solo se declara: no se cobra al reservar (RN-EME-04).
- **RN-RES-05** Una solicitud debe hacerse con al menos **[2 h]** de anticipación al inicio del servicio.

### 8.2 Estados de una reserva

| Estado                                           | Cuándo se entra                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `SOLICITADA`                                     | El dueño envía la solicitud a un cuidador sin Reserva inmediata                       |
| `PENDIENTE_DE_PAGO`                              | El cuidador acepta, o el dueño solicita a un cuidador con Reserva inmediata           |
| `CONFIRMADA`                                     | La pasarela aprueba el pago (aviso por webhook), también uno tarde (RN-PAG-06)        |
| `EN_CURSO`                                       | El cuidador hace check-in `Fase 2`                                                    |
| `FINALIZADA`                                     | El cuidador hace check-out y envía su reporte `Fase 2`                                |
| `CERRADA`                                        | Pasan [48 h] desde el check-out sin disputa y se libera el pago al cuidador `Fase 2`  |
| `RECHAZADA`                                      | El cuidador rechaza la solicitud                                                      |
| `EXPIRADA`                                       | El cuidador no responde a tiempo (RN-RES-06), o el dueño no paga a tiempo (RN-RES-07) |
| `CANCELADA_POR_DUENO` / `CANCELADA_POR_CUIDADOR` | Cancelación (ver sección 10)                                                          |
| `EN_DISPUTA`                                     | Alguien abre una disputa durante la retención del pago `Fase 2`                       |

- **RN-RES-06** El cuidador tiene un plazo para responder que depende de cuánto falta para el servicio cuando el dueño solicita: **[24 h]** si faltan más de 72 h, **[6 h]** si faltan entre 24 y 72 h (con exactamente 72 h o 24 h también), y **[1 h]** si faltan menos de 24 h. Si el servicio empieza antes, el plazo vence al inicio del primer tramo.
- **RN-RES-07** Desde que la reserva pasa a `PENDIENTE_DE_PAGO`, el dueño tiene **[2 h]** para pagar. Si el servicio empieza antes, el plazo vence al inicio del primer tramo.
- **RN-RES-08** La primera reserva Especial con un cuidador nuevo exige un **encuentro previo**. Se hace **después del pago**, para que no sirva para arreglar por fuera; si cualquiera de los dos decide no seguir, se devuelve el 100%. `Fase 2`
- **RN-RES-09** Para urgencias existe la **solicitud abierta**: se envía a todos los cuidadores elegibles de la zona y la toma el primero que acepte. `Fase 2`

## 9. Pagos

**En la demo:** cobro con Wompi en modo de prueba (RN-PAG-01, RN-PAG-02 y RN-PAG-05 a RN-PAG-08). El pago al cuidador se simula.

- **RN-PAG-01** La pasarela es **Wompi** (Banco Agrícola), con una comisión de [3.5%] por transacción. Stripe no acepta empresas de El Salvador. En la demo se usan transacciones de prueba (`esReal = false`).
- **RN-PAG-02** El dueño paga el **total** para confirmar la reserva. Un pago cuenta como aprobado solo cuando llega el webhook de Wompi, no cuando el usuario vuelve a la app.
- **RN-PAG-03** Pawie retiene el dinero y le paga al cuidador **[48 h]** después del check-out si nadie abrió una disputa. En la demo este pago es simulado. `Fase 2`
- **RN-PAG-04** En estadías largas, el pago al cuidador se libera por semanas completadas. `Fase 2`
- **RN-PAG-05** Los reembolsos se hacen por el mismo medio de pago. La API de Wompi no tiene un endpoint de reembolso, así que se hacen desde el panel de Wompi y el administrador los registra en Pawie. Mientras tanto, el pago queda **por reembolsar**.
- **RN-PAG-06** Si el pago se aprueba cuando la reserva ya venció, la reserva **se confirma si el horario sigue libre**. Si otra reserva tomó ese horario, la reserva sigue vencida y el pago se reembolsa (RN-PAG-05).
- **RN-PAG-07** Una reserva se paga una sola vez. Un **segundo pago aprobado** de la misma reserva se reembolsa, y también el pago de una reserva que el dueño **ya canceló** (RN-CAN-07): se respeta que decidió cancelar.
- **RN-PAG-08** El dueño paga en un **enlace de pago** de Wompi que acepta un solo pago y vence con el plazo de pago (RN-RES-07). Si vuelve a pagar mientras el enlace está pendiente, se usa el mismo; si su tarjeta es rechazada, puede reintentar ahí mismo.

## 10. Cancelaciones

**En la demo:** solo la cancelación sin costo antes de pagar (RN-CAN-07). Lo demás es Fase 2.

- **RN-CAN-01** Si el dueño cancela una reserva ya pagada, la devolución depende de cuánto falta para el inicio:
  - más de **[48 h]**: 100%;
  - entre **[24 y 48 h]**: **[50%]**;
  - menos de **[24 h]**: nada.
- **RN-CAN-02** El dinero que no se devuelve se reparte en las mismas proporciones que una reserva normal (lo que le toca al cuidador y lo que le toca a Pawie).
- **RN-CAN-03** Si la mascota está hospitalizada o murió y hay una constancia, se devuelve el 100% sin importar el plazo.
- **RN-CAN-04** Si el servicio ya empezó, no se devuelve nada por el tiempo restante, salvo que haya una disputa.
- **RN-CAN-05** Si cancela el cuidador, no paga dinero, pero queda en su historial. Con **[3] cancelaciones en [90] días** se suspende por **[15 días]**. Si cancela un cuidado Especial con menos de 48 h de anticipación, se le suspende la ⭐ por **[30 días]**.
- **RN-CAN-06** Cuando cancela el cuidador, Pawie busca un reemplazo con prioridad. Si no lo consigue, devuelve el 100% al dueño y le da un crédito del **[10%]** del valor de la reserva para la próxima.
- **RN-CAN-07** Mientras la reserva está `SOLICITADA` o `PENDIENTE_DE_PAGO`, el dueño puede cancelarla sin costo, porque todavía no pagó nada. Pasa a `CANCELADA_POR_DUENO` y libera el horario del cuidador. Si después llega un pago aprobado de esa reserva, se reembolsa (RN-PAG-07).

## 11. Ejecución del servicio `Fase 2`

- **RN-EJE-01** El cuidador hace check-in y check-out en la app, y se registran la hora y la ubicación.
- **RN-EJE-02** Si no hay check-in **[30 min]** después de la hora de inicio, se avisa al dueño y a Pawie, se busca un reemplazo y, si no se consigue, se devuelve el dinero.
- **RN-EJE-03** **Bitácora:** cada visita o cada día de pernocta lleva al menos un reporte con foto.
- **RN-EJE-04** En cuidado Especial se registra cada dosis programada, con hora y observaciones. Si una dosis no se registra, se avisa al dueño automáticamente.
- **RN-EJE-05** La bitácora queda en el **historial de cuidado** de la mascota, y el dueño puede compartirlo con su veterinario.

## 12. Emergencias

**En la demo:** solo se capturan los datos de emergencia al solicitar (RN-RES-04). El resto es `Fase 2`.

- **RN-EME-01** El cuidador tiene un **botón de emergencia**. Al usarlo se avisa al dueño y a Pawie, se muestran las clínicas 24 h cercanas y queda registrado un incidente.
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
- **RN-EME-04** El cuidador **nunca pone dinero de su bolsillo**. Pawie le paga a la clínica hasta el monto preautorizado y después le cobra al dueño con un enlace de pago. Wompi puede guardar tarjetas, pero pide el CVV en cada cobro, así que no se puede cobrar sin que el dueño participe. Si el dueño no paga, la pérdida la asume Pawie. El transporte a la clínica se reembolsa.
- **RN-EME-05** Si la mascota muere durante un servicio, se sigue este protocolo: aviso inmediato al dueño, el administrador revisa la bitácora y el incidente, y el cuidador no recibe sanción si siguió el protocolo.

## 13. Reseñas y reputación `Fase 2`

**En la demo:** las calificaciones son datos de prueba.

- **RN-RSE-01** Las reseñas van en los dos sentidos (dueño a cuidador y cuidador a dueño). Solo se pueden escribir después de una reserva `FINALIZADA` y dentro de **[7 días]**.
- **RN-RSE-02** Las dos reseñas se publican juntas, cuando ambos escribieron o cuando vence el plazo. Así nadie ve la del otro antes de escribir la suya.
- **RN-RSE-03** Si un cuidador tiene un promedio menor a **[4.0]** después de **[5]** servicios, lo revisa un administrador.
- **RN-RSE-04** El cuidador ve las reseñas del dueño antes de aceptar una solicitud.
- **RN-RSE-05** Las reseñas, la ⭐ y la cantidad de servicios solo cuentan con servicios hechos en Pawie.

## 14. Disputas `Fase 2`

- **RN-DIS-01** El dueño puede abrir una disputa durante las **[48 h]** en que el pago está retenido. Mientras tanto, el pago al cuidador queda congelado.
- **RN-DIS-02** La bitácora, las fotos y los registros de check-in y check-out sirven como prueba. Un administrador resuelve en **[5 días hábiles]**.

## 15. Parámetros configurables

Se guardan en la base de datos, no en el código. En la demo se cambian con un script o un seed; en Fase 2, desde el panel de administración. Cambiarlos no afecta las reservas ya creadas (RN-PRE-07).

| Parámetro                                            | Valor inicial                       | Regla     |
| ---------------------------------------------------- | ----------------------------------- | --------- |
| Comisión al cuidador                                 | 15%                                 | RN-PRE-04 |
| Tarifa de servicio al dueño                          | 10%                                 | RN-PRE-03 |
| Recargo por mascota adicional                        | 50%                                 | RN-PRE-02 |
| Rangos y precios sugeridos por servicio y nivel      | Ver tabla de RN-PRE-01              | RN-PRE-01 |
| Fondo de Garantía Pawie                              | 2%                                  | RN-PRE-06 |
| IVA                                                  | 13%                                 | RN-PRE-06 |
| Comisión de la pasarela                              | 3.5%                                | RN-PAG-01 |
| Duración máxima de una visita                        | 60 min                              | RN-SER-01 |
| Horario de pernocta                                  | 19:00–08:00                         | RN-SER-02 |
| Máximo de mascotas por reserva                       | 3                                   | RN-RES-03 |
| Anticipación mínima para solicitar                   | 2 h                                 | RN-RES-05 |
| Plazo de respuesta del cuidador                      | 24 h / 6 h / 1 h                    | RN-RES-06 |
| Plazo de pago                                        | 2 h                                 | RN-RES-07 |
| Retención del pago                                   | 48 h                                | RN-PAG-03 |
| Ventanas de cancelación del dueño                    | 48 h y 24 h; 100% / 50% / 0%        | RN-CAN-01 |
| Cancelaciones del cuidador antes de suspender        | 3 en 90 días; suspensión de 15 días | RN-CAN-05 |
| Suspensión de la ⭐ por cancelar un cuidado Especial | 30 días                             | RN-CAN-05 |
| Crédito al dueño si no hay reemplazo                 | 10%                                 | RN-CAN-06 |
| Tolerancia de check-in                               | 30 min                              | RN-EJE-02 |
| Espera al dueño en emergencias sin señales de alarma | 10 min                              | RN-EME-03 |
| Plazo para escribir una reseña                       | 7 días                              | RN-RSE-01 |
| Umbral de revisión por calificación                  | 4.0 después de 5 servicios          | RN-RSE-03 |
| Nota mínima del curso ⭐                             | 80%                                 | RN-CUI-08 |
| Vigencia de la ⭐                                    | 12 meses                            | RN-CUI-09 |
| Calificación mínima para conservar la ⭐             | 4.0 en servicios especiales         | RN-CUI-10 |
| Plazo para resolver disputas                         | 5 días hábiles                      | RN-DIS-02 |

## 16. Garantía Pawie y fidelización

- **RN-FID-01** La **Garantía Pawie** viene incluida en cada reserva hecha en Pawie. Cubre:
  - los daños que cause el cuidador durante el servicio, por algo que hizo o dejó de hacer, hasta un tope por evento que falta definir;
  - un reemplazo si el cuidador cancela.

  **No cubre** el avance de una enfermedad que la mascota ya tenía. Se paga con el fondo de RN-PRE-06. Más adelante puede contratarse con una aseguradora aliada para sacar el riesgo de las cuentas de Pawie.

- **RN-FID-02** La garantía, el historial de cuidado y la reputación **solo existen en reservas hechas en Pawie**. Fuera de la plataforma no hay respaldo, el historial no se actualiza y el perfil del cuidador no avanza.
- **RN-FID-03** Pawie entrega a los cuidadores una **constancia de horas de experiencia** generada con sus servicios completados. Es especialmente útil para estudiantes; conviene buscar convenios con facultades de veterinaria para que cuente en sus prácticas. `Fase 2`
- **RN-FID-04** Mientras no haya una reserva confirmada, el chat interno filtra teléfonos, correos y redes sociales (complementa RN-CTA-04). `Fase 2`

## 17. Ideas para después

- Paseos y hospedaje en la casa del cuidador.
- Animales exóticos, cada uno con su propia certificación.
- Certificación "Inyectables" (insulina, sueros), que abre servicios para perros diabéticos y gatos con problemas renales.
- **Plan Protección Pawie:** una suscripción mensual de seguro o asistencia contratada con un socio. No entra en la demo, porque estos productos suelen excluir a las mascotas mayores, crónicas o con enfermedades previas, que son el segmento de cuidado especial. Como referencia, en El Salvador ya hay asistencias para mascotas incluidas con tarjetas bancarias por unos $5–7.50 al mes.
- Paquetes prepagados con descuento (por ejemplo, 10 visitas).
- Bono para cuidadores en temporada alta (diciembre, Semana Santa).
- Convenios con clínicas veterinarias, que pueden recomendar Pawie al dar de alta a una mascota operada y servir como red de emergencias.

## 18. Pendientes por validar

| Tema                            | Qué validar                                                                                                                                                                                           | Con quién                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Precios                         | Que los rangos de RN-PRE-01 funcionen                                                                                                                                                                 | Unos 10 dueños y 3 clínicas |
| Laboral                         | Que los cuidadores no se consideren empleados                                                                                                                                                         | Abogado                     |
| Ejercicio profesional           | Qué puede hacer legalmente un estudiante sin licencia                                                                                                                                                 | Abogado y veterinario       |
| Fondos de terceros              | Si Pawie puede retener el dinero de los cuidadores                                                                                                                                                    | Abogado                     |
| Impuestos                       | Cómo se aplica el IVA y cómo se factura a cuidadores informales                                                                                                                                       | Contador                    |
| Datos personales                | Cómo guardar antecedentes penales, DUI y direcciones                                                                                                                                                  | Abogado                     |
| Verificación                    | Qué documentos de antecedentes se exigirán (RN-CUI-01)                                                                                                                                                | Abogado                     |
| Wompi                           | Cómo pagar a los cuidadores. Ya confirmado en su documentación: no hay reembolsos por API, la tarjeta guardada pide el CVV en cada cobro y un negocio en desarrollo aprueba todos los pagos de prueba | Wompi                       |
| Garantía                        | Tope por evento (RN-FID-01)                                                                                                                                                                           | Equipo y una aseguradora    |
| Emergencias                     | Cómo cubrir el riesgo de que el dueño no pague un gasto que Pawie adelantó (RN-EME-04)                                                                                                                | Equipo                      |
| Seguro de responsabilidad civil | Costo de cubrir mordeduras y daños                                                                                                                                                                    | Aseguradora                 |
