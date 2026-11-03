import type { PrismaClient } from '../generated/prisma/client.js';
import { WELCOME_COURSE_CODE } from '../courses/courses.service.js';

export interface SeedQuestion {
  prompt: string;
  options: string[];
  /** Index of the right option. */
  correctOption: number;
}

export interface SeedModule {
  title: string;
  /** Paragraphs separated by a blank line. */
  body: string;
  questions: SeedQuestion[];
}

// TODO(contenido): the team writes the welcome course (docs/plan-v0.6.md §4, "Contenido del
// curso de bienvenida"). These are placeholders: the four modules RN-CUI-02 names, each with
// a short lesson and three questions taken from the rules they cite, so the flow can be
// tried end to end. Replace the lessons and the questions, keeping the structure.
export const WELCOME_COURSE = {
  title: 'Curso de bienvenida',
  modules: [
    // TODO(contenido): lesson and questions about the platform rules.
    {
      title: 'Reglas de la plataforma',
      body: [
        'En Pawie todo pasa dentro de la app: la solicitud, el pago y cada servicio. Así el dueño está protegido por la garantía y tú tienes tu pago asegurado.',
        'Ves la dirección exacta del dueño cuando la reserva está confirmada. Antes solo ves el distrito.',
        'El dueño entrega siempre el alimento, los premios, los medicamentos y los insumos. Tú nunca los compras ni los cambias por otros.',
        'Hay cosas que ningún cuidador de Pawie hace: poner inyecciones (la insulina incluida) o sueros, quitar puntos, sedar, cambiar dosis, diagnosticar o recetar.',
      ].join('\n\n'),
      questions: [
        {
          prompt: '¿Cuándo ves la dirección exacta del dueño?',
          options: [
            'Cuando el dueño me envía la solicitud',
            'Cuando la reserva está confirmada',
            'Nunca, solo veo el distrito',
          ],
          correctOption: 1, // RN-CTA-04
        },
        {
          prompt: '¿Quién compra el alimento, los premios y los medicamentos?',
          options: ['Yo, y después se los cobro al dueño', 'El dueño siempre los entrega', 'Pawie'],
          correctOption: 1, // RN-CUI-14
        },
        {
          prompt: 'Un dueño te pide ponerle la insulina a su perro. ¿Qué haces?',
          options: [
            'La pongo si tengo la certificación de cuidado especial',
            'La pongo si el veterinario lo indica por escrito',
            'No la pongo: ningún cuidador de Pawie pone inyecciones',
          ],
          correctOption: 2, // RN-CUI-13
        },
      ],
    },
    // TODO(contenido): lesson and questions about handling dogs and cats.
    {
      title: 'Manejo de perros y gatos',
      body: [
        'Cada mascota tiene su carácter. Lee su temperamento y sus notas de manejo en la ficha antes de llegar.',
        'Deja que la mascota se acerque a su ritmo. Con los gatos, no los cargues ni los persigas para conocerlos.',
        'Una mascota en celo no es una mascota enferma: atiéndela con su rutina de siempre, sin aislarla.',
      ].join('\n\n'),
      questions: [
        {
          prompt: '¿Cómo saludas a un gato que no te conoce?',
          options: [
            'Lo cargo de inmediato',
            'Dejo que se acerque él, sin forzarlo',
            'Lo sigo por la casa hasta que se acostumbre',
          ],
          correctOption: 1,
        },
        {
          prompt: 'Una perra está en celo durante el servicio. ¿Qué haces?',
          options: [
            'La dejo encerrada en un cuarto todo el servicio',
            'La atiendo con su rutina, sin aislarla',
            'Cancelo el servicio',
          ],
          correctOption: 1, // RN-MAS-11
        },
        {
          prompt: 'Un perro gruñe cuando te acercas a su plato. ¿Qué haces?',
          options: [
            'Le quito el plato para enseñarle',
            'Le doy espacio mientras come y se lo cuento al dueño',
            'Lo regaño',
          ],
          correctOption: 1,
        },
      ],
    },
    // TODO(contenido): lesson and questions about following the pet's profile and routine.
    {
      title: 'Respetar la ficha y la rutina',
      body: [
        'La ficha de la mascota dice qué come, cuánto y a qué hora, qué premios puede comer, sus medicinas y su rutina. Síguela tal cual.',
        'En cada visita o noche, la app te muestra las tareas que caen en tu horario: las comidas y las medicinas de la ficha, y las tareas de cuidado.',
        'Nunca cambies una dosis, aunque la mascota se vea mejor. Si algo no cuadra con la ficha, escríbele al dueño.',
      ].join('\n\n'),
      questions: [
        {
          prompt: 'La ficha dice que Toby come una taza a las 7:00. Toby pide más. ¿Qué haces?',
          options: ['Le doy otra taza', 'Sigo la porción de la ficha', 'Le doy comida de mi casa'],
          correctOption: 1, // RN-MAS-02, RN-CUI-14
        },
        {
          prompt: '¿Puedes cambiar la dosis de un medicamento si la mascota se ve mejor?',
          options: [
            'Sí, si la mascota se ve mejor',
            'No: ningún cuidador cambia dosis',
            'Sí, si el dueño me lo pide por chat',
          ],
          correctOption: 1, // RN-CUI-13
        },
        {
          prompt: '¿Qué tareas te tocan en una visita?',
          options: [
            'Las comidas y medicinas cuyo horario cae dentro de la visita',
            'Todas las del día',
            'Solo las que el dueño me recuerde',
          ],
          correctOption: 0, // RN-MAS-12
        },
      ],
    },
    // TODO(contenido): lesson and questions about emergencies, validated by a vet.
    {
      title: 'Qué hacer en una emergencia',
      body: [
        'Ante una señal de alarma, ve a la clínica de inmediato y avisa al mismo tiempo. Son señales de alarma: dificultad para respirar, convulsiones, sangrado que no para, posible intoxicación, desmayo o no poder levantarse, golpe de calor y una herida quirúrgica abierta.',
        'En un perro, el abdomen hinchado y duro con arcadas sin poder vomitar. En un gato, hacer esfuerzo para orinar sin lograrlo.',
        'Si no hay señales de alarma, primero contacta al dueño. Si no responde en 10 minutos, llama a su veterinario de cabecera.',
      ].join('\n\n'),
      questions: [
        {
          prompt: 'La mascota tiene dificultad para respirar. ¿Qué haces primero?',
          options: [
            'Espero a que el dueño me responda',
            'Voy a la clínica de inmediato y aviso al mismo tiempo',
            'Le doy un medicamento que tengo en casa',
          ],
          correctOption: 1, // RN-EME-02
        },
        {
          prompt:
            'Vomitó una vez y está tranquila, sin señales de alarma. ¿A quién llamas primero?',
          options: [
            'Al dueño, y si no responde en 10 minutos, a su veterinario',
            'A una clínica 24 horas',
            'A nadie',
          ],
          correctOption: 0, // RN-EME-03
        },
        {
          prompt: '¿Cuál de estas es una señal de alarma en un perro?',
          options: [
            'Que duerma mucho después de jugar',
            'El abdomen hinchado y duro, con arcadas sin poder vomitar',
            'Que no quiera un premio',
          ],
          correctOption: 1, // RN-EME-02
        },
      ],
    },
  ] satisfies SeedModule[],
};

/**
 * Loads the welcome course (RN-CUI-02). Modules and questions are upserted by their
 * position, so their ids stay the same between runs; the ones past the end of the content
 * are deleted. Attempts keep their answers as they were.
 */
export async function seedWelcomeCourse(prisma: PrismaClient): Promise<void> {
  const course = await prisma.course.upsert({
    where: { code: WELCOME_COURSE_CODE },
    create: { code: WELCOME_COURSE_CODE, title: WELCOME_COURSE.title },
    update: { title: WELCOME_COURSE.title },
  });
  await prisma.courseModule.deleteMany({
    where: { courseId: course.id, position: { gt: WELCOME_COURSE.modules.length } },
  });

  for (const [moduleIndex, { title, body, questions }] of WELCOME_COURSE.modules.entries()) {
    const position = moduleIndex + 1;
    const module = await prisma.courseModule.upsert({
      where: { courseId_position: { courseId: course.id, position } },
      create: { courseId: course.id, position, title, body },
      update: { title, body },
    });
    await prisma.courseQuestion.deleteMany({
      where: { moduleId: module.id, position: { gt: questions.length } },
    });
    for (const [questionIndex, question] of questions.entries()) {
      await prisma.courseQuestion.upsert({
        where: { moduleId_position: { moduleId: module.id, position: questionIndex + 1 } },
        create: { moduleId: module.id, position: questionIndex + 1, ...question },
        update: question,
      });
    }
  }
}
