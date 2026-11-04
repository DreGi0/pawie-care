import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { caregiverProfileNotFound } from '../caregivers/caregiver-errors.js';
import { Clock } from '../common/time/clock.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import type {
  CourseAttemptRequest,
  CourseAttemptResponse,
  WelcomeCourseResponse,
} from './courses.dto.js';
import { answersFitExam, gradeExam } from './grade-exam.js';

/** The code of the welcome course in the courses table. The seed loads it. */
export const WELCOME_COURSE_CODE = 'WELCOME';

const courseInclude = {
  modules: {
    orderBy: { position: 'asc' },
    include: { questions: { orderBy: { position: 'asc' } } },
  },
} satisfies Prisma.CourseInclude;

/**
 * RN-CUI-02: the welcome course and its exam, which the API grades. A caregiver can
 * repeat it; the first passing attempt marks the course as passed for good.
 */
@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  async welcomeCourse(caregiverId: string): Promise<WelcomeCourseResponse> {
    const passedAt = await this.passedAt(caregiverId);
    const course = await this.findWelcomeCourse();
    return {
      title: course.title,
      passingScoreBp: await this.settings.get('certifications.minExamScoreBp'),
      passedAt: passedAt?.toISOString() ?? null,
      modules: course.modules.map(({ id, position, title, body, questions }) => ({
        id,
        position,
        title,
        body,
        // Never the right option: the API grades the exam.
        questions: questions.map(({ id, prompt, options }) => ({ id, prompt, options })),
      })),
    };
  }

  async submitWelcomeExam(
    caregiverId: string,
    { answers }: CourseAttemptRequest,
  ): Promise<CourseAttemptResponse> {
    await this.passedAt(caregiverId);
    const course = await this.findWelcomeCourse();
    const questions = course.modules.flatMap((module) => module.questions);
    if (!answersFitExam(questions, answers)) {
      throw new UnprocessableEntityException({
        errorCode: 'INVALID_ANSWERS',
        message: 'Responde todas las preguntas del examen y vuelve a enviarlo.',
      });
    }
    const passingScoreBp = await this.settings.get('certifications.minExamScoreBp');
    const grade = gradeExam(questions, answers, passingScoreBp);
    const now = this.clock.now();

    const passedAt = await this.prisma.$transaction(async (tx) => {
      await tx.courseAttempt.create({
        data: {
          courseId: course.id,
          caregiverId,
          scoreBp: grade.scoreBp,
          passed: grade.passed,
          answers: Object.fromEntries(
            answers.map(({ questionId, option }) => [questionId, option]),
          ),
        },
      });
      if (grade.passed) {
        // Only the first pass counts: a later attempt doesn't move the date.
        await tx.caregiverProfile.updateMany({
          where: { userId: caregiverId, welcomeCoursePassedAt: null },
          data: { welcomeCoursePassedAt: now },
        });
      }
      const profile = await tx.caregiverProfile.findUniqueOrThrow({
        where: { userId: caregiverId },
        select: { welcomeCoursePassedAt: true },
      });
      return profile.welcomeCoursePassedAt;
    });

    return {
      scoreBp: grade.scoreBp,
      passed: grade.passed,
      correctCount: grade.correctCount,
      questionCount: grade.questionCount,
      passingScoreBp,
      incorrectQuestionIds: grade.incorrectQuestionIds,
      passedAt: passedAt?.toISOString() ?? null,
    };
  }

  /** When the caregiver passed the course. Throws if the account has no caregiver profile. */
  private async passedAt(caregiverId: string): Promise<Date | null> {
    const profile = await this.prisma.caregiverProfile.findUnique({
      where: { userId: caregiverId },
      select: { welcomeCoursePassedAt: true },
    });
    if (!profile) {
      throw caregiverProfileNotFound();
    }
    return profile.welcomeCoursePassedAt;
  }

  private async findWelcomeCourse() {
    const course = await this.prisma.course.findUnique({
      where: { code: WELCOME_COURSE_CODE },
      include: courseInclude,
    });
    if (!course || course.modules.every(({ questions }) => questions.length === 0)) {
      throw new NotFoundException({
        errorCode: 'COURSE_NOT_FOUND',
        message: 'El curso de bienvenida todavía no está disponible.',
      });
    }
    return course;
  }
}
