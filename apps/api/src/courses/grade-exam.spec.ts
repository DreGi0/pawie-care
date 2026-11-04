import { answersFitExam, type ExamQuestion, gradeExam } from './grade-exam.js';

/** Twelve questions, as the welcome course has: 4 modules of 3. The right option is 1. */
const QUESTIONS: ExamQuestion[] = Array.from({ length: 12 }, (_, index) => ({
  id: `q${index + 1}`,
  options: ['a', 'b', 'c'],
  correctOption: 1,
}));
const MIN_SCORE_BP = 8000; // §15: 80%

/** Answers with the first `wrong` questions answered wrong. */
const answersWith = (wrong: number) =>
  QUESTIONS.map(({ id }, index) => ({ questionId: id, option: index < wrong ? 0 : 1 }));

describe('gradeExam (RN-CUI-02)', () => {
  it('passes with every answer right', () => {
    expect(gradeExam(QUESTIONS, answersWith(0), MIN_SCORE_BP)).toEqual({
      correctCount: 12,
      questionCount: 12,
      scoreBp: 10_000,
      passed: true,
      incorrectQuestionIds: [],
    });
  });

  it('passes with 10 of 12, which is 83%', () => {
    expect(gradeExam(QUESTIONS, answersWith(2), MIN_SCORE_BP)).toMatchObject({
      scoreBp: 8333,
      passed: true,
    });
  });

  it('fails with 9 of 12, which is 75%, and says which ones were wrong', () => {
    expect(gradeExam(QUESTIONS, answersWith(3), MIN_SCORE_BP)).toEqual({
      correctCount: 9,
      questionCount: 12,
      scoreBp: 7500,
      passed: false,
      incorrectQuestionIds: ['q1', 'q2', 'q3'],
    });
  });

  it('passes exactly at the minimum', () => {
    const five = QUESTIONS.slice(0, 5);
    const fourRight = five.map(({ id }, index) => ({
      questionId: id,
      option: index === 0 ? 0 : 1,
    }));

    expect(gradeExam(five, fourRight, MIN_SCORE_BP)).toMatchObject({ scoreBp: 8000, passed: true });
  });

  it('rounds the score down, so a failing score never reads as the minimum', () => {
    const questions = QUESTIONS.slice(0, 3);
    const twoRight = questions.map(({ id }, index) => ({
      questionId: id,
      option: index === 0 ? 0 : 1,
    }));

    expect(gradeExam(questions, twoRight, 6667)).toMatchObject({ scoreBp: 6666, passed: false });
  });

  it('follows the minimum score of §15', () => {
    expect(gradeExam(QUESTIONS, answersWith(3), 7500).passed).toBe(true);
  });
});

describe('answersFitExam', () => {
  it('takes every question once', () => {
    expect(answersFitExam(QUESTIONS, answersWith(0))).toBe(true);
  });

  it('refuses a missing, repeated or unknown question', () => {
    const answers = answersWith(0);

    expect(answersFitExam(QUESTIONS, answers.slice(1))).toBe(false);
    expect(answersFitExam(QUESTIONS, [...answers.slice(1), answers[1]])).toBe(false);
    expect(answersFitExam(QUESTIONS, [...answers.slice(1), { questionId: 'q99', option: 1 }])).toBe(
      false,
    );
  });

  it('refuses an option the question does not have', () => {
    const answers = answersWith(0);
    answers[0] = { questionId: 'q1', option: 3 };

    expect(answersFitExam(QUESTIONS, answers)).toBe(false);
  });
});
