/** 10 000 basis points are 100%. */
const WHOLE_BP = 10_000;

export interface ExamQuestion {
  id: string;
  options: readonly string[];
  /** Index of the right option. */
  correctOption: number;
}

export interface ExamAnswer {
  questionId: string;
  /** Index of the chosen option. */
  option: number;
}

export interface ExamGrade {
  correctCount: number;
  questionCount: number;
  /** Share of right answers, rounded down, so it never shows a passing figure that isn't. */
  scoreBp: number;
  passed: boolean;
  incorrectQuestionIds: string[];
}

/**
 * Whether the answers are exactly the exam: every question once, nothing else, and each
 * option one of the question's. The app always sends them like that.
 */
export function answersFitExam(
  questions: readonly ExamQuestion[],
  answers: readonly ExamAnswer[],
): boolean {
  const byId = new Map(questions.map((question) => [question.id, question]));
  const answered = new Set(answers.map(({ questionId }) => questionId));
  return (
    answers.length === questions.length &&
    answered.size === answers.length &&
    answers.every(({ questionId, option }) => {
      const question = byId.get(questionId);
      return question !== undefined && option >= 0 && option < question.options.length;
    })
  );
}

/**
 * RN-CUI-02, RN-CUI-08: grades an exam whose answers fit it (answersFitExam). It passes
 * with at least `minScoreBp` of right answers, compared without rounding.
 */
export function gradeExam(
  questions: readonly ExamQuestion[],
  answers: readonly ExamAnswer[],
  minScoreBp: number,
): ExamGrade {
  if (questions.length === 0) {
    throw new RangeError('An exam needs at least one question');
  }
  const chosen = new Map(answers.map(({ questionId, option }) => [questionId, option]));
  const incorrectQuestionIds = questions
    .filter(({ id, correctOption }) => chosen.get(id) !== correctOption)
    .map(({ id }) => id);
  const questionCount = questions.length;
  const correctCount = questionCount - incorrectQuestionIds.length;
  return {
    correctCount,
    questionCount,
    scoreBp: Math.floor((correctCount * WHOLE_BP) / questionCount),
    // correct / total ≥ min / 10 000, in integers.
    passed: correctCount * WHOLE_BP >= minScoreBp * questionCount,
    incorrectQuestionIds,
  };
}
