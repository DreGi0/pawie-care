import {
  getCaregiverMeGetQueryKey,
  getCoursesWelcomeQueryKey,
  useCoursesSubmit,
  useCoursesWelcome,
  type CourseAttemptResponse,
  type CourseModuleResponse,
  type WelcomeCourseResponse,
} from '@pawie/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Nimbus } from '@/components/Nimbus';
import { Row } from '@/components/Row';
import { StepBar } from '@/components/StepBar';
import { Text } from '@/components/Text';
import { Touchable } from '@/components/Touchable';
import { errorMessage, queryClient } from '@/lib/api';
import { formatDay } from '@/lib/format';
import { borderWidth, colors, gutter, radius, space } from '@/theme/tokens';

type Stage =
  | { kind: 'modules' }
  | { kind: 'exam'; index: number }
  | { kind: 'result'; result: CourseAttemptResponse };

/** 8333 basis points read "83%": rounded down, as the API rounds the score. */
const percent = (bp: number) => `${Math.floor(bp / 100)}%`;

// CuiCurso (RN-CUI-02): the modules to read, then the exam one question at a time, and the
// result. The API grades it; the app never sees the right answers.
export default function WelcomeCourseScreen() {
  const course = useCoursesWelcome();
  const [stage, setStage] = useState<Stage>({ kind: 'modules' });
  const [answers, setAnswers] = useState<Record<string, number>>({});

  return (
    <SafeAreaView style={styles.screen}>
      {course.isPending ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : course.isError ? (
        <View style={styles.content}>
          <IconButton
            icon="chevron-left"
            accessibilityLabel="Volver"
            onPress={() => router.back()}
          />
          <Banner tone="error" message={errorMessage(course.error)} />
        </View>
      ) : stage.kind === 'modules' ? (
        <Modules
          course={course.data}
          onStart={() => {
            setAnswers({});
            setStage({ kind: 'exam', index: 0 });
          }}
        />
      ) : stage.kind === 'exam' ? (
        <Exam
          course={course.data}
          index={stage.index}
          answers={answers}
          onAnswer={(questionId, option) => setAnswers({ ...answers, [questionId]: option })}
          onMove={(index) => setStage(index < 0 ? { kind: 'modules' } : { kind: 'exam', index })}
          onGraded={(result) => setStage({ kind: 'result', result })}
        />
      ) : (
        <Result
          course={course.data}
          result={stage.result}
          onRetry={() => setStage({ kind: 'modules' })}
        />
      )}
    </SafeAreaView>
  );
}

function Modules({ course, onStart }: { course: WelcomeCourseResponse; onStart: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const questionCount = course.modules.reduce((sum, { questions }) => sum + questions.length, 0);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <IconButton icon="chevron-left" accessibilityLabel="Volver" onPress={() => router.back()} />
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          {course.title}
        </Text>
        <Text color="inkMuted">
          {course.modules.length} módulos cortos y un examen de {questionCount} preguntas. Apruebas
          con {percent(course.passingScoreBp)} y puedes repetirlo las veces que quieras.
        </Text>
      </View>
      {course.passedAt && (
        <Banner tone="success" message={`Lo aprobaste el ${formatDay(course.passedAt)}.`} />
      )}

      <View>
        {course.modules.map((module, index) => {
          const expanded = open === module.id;
          return (
            <View key={module.id}>
              <Row
                divider={index > 0}
                onPress={() => setOpen(expanded ? null : module.id)}
                accessibilityLabel={`Módulo ${module.position}, ${module.title}`}
              >
                <View style={styles.number}>
                  <Text variant="label">{module.position}</Text>
                </View>
                <View style={styles.flex}>
                  <Text variant="subheading">{module.title}</Text>
                  <Text variant="caption" color="inkMuted">
                    {module.questions.length} preguntas en el examen
                  </Text>
                </View>
                <Icon name={expanded ? 'chevron-down' : 'chevron-right'} color="inkMuted" />
              </Row>
              {expanded && (
                <Animated.View entering={FadeIn.duration(200)} style={styles.lesson}>
                  {module.body.split('\n\n').map((paragraph) => (
                    <Text key={paragraph}>{paragraph}</Text>
                  ))}
                </Animated.View>
              )}
            </View>
          );
        })}
      </View>

      <Button
        variant={course.passedAt ? 'secondary' : 'primary'}
        label={course.passedAt ? 'Repetir el examen' : 'Empezar el examen'}
        onPress={onStart}
      />
    </ScrollView>
  );
}

function Exam({
  course,
  index,
  answers,
  onAnswer,
  onMove,
  onGraded,
}: {
  course: WelcomeCourseResponse;
  index: number;
  answers: Record<string, number>;
  onAnswer: (questionId: string, option: number) => void;
  onMove: (index: number) => void;
  onGraded: (result: CourseAttemptResponse) => void;
}) {
  const questions = course.modules.flatMap((module) =>
    module.questions.map((question) => ({ ...question, module: module.title })),
  );
  const question = questions[index];
  const chosen = answers[question.id];
  const last = index === questions.length - 1;
  const submit = useCoursesSubmit({
    mutation: {
      onSuccess: (result) => {
        void queryClient.invalidateQueries({ queryKey: getCoursesWelcomeQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getCaregiverMeGetQueryKey() });
        onGraded(result);
      },
    },
  });

  const next = () => {
    if (!last) return onMove(index + 1);
    submit.mutate({
      data: {
        answers: questions.map(({ id }) => ({ questionId: id, option: answers[id] })),
      },
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.examTop}>
        <IconButton icon="x" accessibilityLabel="Salir del examen" onPress={() => onMove(-1)} />
        <View style={styles.flex}>
          <StepBar current={index + 1} total={questions.length} noun="Pregunta" />
        </View>
      </View>

      <Animated.View key={question.id} entering={FadeIn.duration(250)} style={styles.question}>
        <Text variant="caption" color="inkMuted">
          {question.module}
        </Text>
        <Text variant="heading" accessibilityRole="header">
          {question.prompt}
        </Text>
        <View accessibilityRole="radiogroup" style={styles.options}>
          {question.options.map((option, optionIndex) => {
            const selected = chosen === optionIndex;
            return (
              <Touchable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={option}
                onPress={() => onAnswer(question.id, optionIndex)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <Text style={styles.flex}>{option}</Text>
                {selected && <Icon name="check" />}
              </Touchable>
            );
          })}
        </View>
      </Animated.View>

      {submit.isError && <Banner tone="error" message={errorMessage(submit.error)} />}
      <View style={styles.actions}>
        <Button
          label={last ? 'Enviar examen' : 'Siguiente'}
          disabled={chosen === undefined}
          loading={submit.isPending}
          onPress={next}
        />
        {index > 0 && <Button variant="ghost" label="Anterior" onPress={() => onMove(index - 1)} />}
      </View>
    </ScrollView>
  );
}

function Result({
  course,
  result,
  onRetry,
}: {
  course: WelcomeCourseResponse;
  result: CourseAttemptResponse;
  onRetry: () => void;
}) {
  const toReview: CourseModuleResponse[] = course.modules.filter((module) =>
    module.questions.some(({ id }) => result.incorrectQuestionIds.includes(id)),
  );

  if (result.passed) {
    return (
      <ScrollView contentContainerStyle={[styles.content, styles.result]}>
        {/* Nimbus celebrates the pass, once on the screen. */}
        <Nimbus pose="hola" background="tint" size={120} />
        <View style={styles.header}>
          <Text variant="title" accessibilityRole="header" style={styles.centered}>
            ¡Aprobaste el curso!
          </Text>
          <Text color="inkMuted" style={styles.centered}>
            Sacaste {percent(result.scoreBp)}: {result.correctCount} de {result.questionCount}{' '}
            respuestas correctas.
          </Text>
        </View>
        <Button label="Volver a Inicio" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          Esta vez no alcanzó
        </Text>
        <Text color="inkMuted">
          Sacaste {percent(result.scoreBp)} y necesitas {percent(result.passingScoreBp)}. Puedes
          repetir el examen las veces que quieras.
        </Text>
      </View>
      {toReview.length > 0 && (
        <View style={styles.section}>
          <Text variant="heading" accessibilityRole="header">
            Repasa estos módulos
          </Text>
          <View>
            {toReview.map((module, index) => (
              <Row key={module.id} divider={index > 0}>
                <View style={styles.number}>
                  <Text variant="label">{module.position}</Text>
                </View>
                <Text variant="subheading" style={styles.flex}>
                  {module.title}
                </Text>
              </Row>
            ))}
          </View>
        </View>
      )}
      <Button label="Repasar y repetir" onPress={onRetry} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    gap: space[6],
    paddingHorizontal: gutter,
    paddingTop: space[1],
    paddingBottom: space[8],
  },
  loading: { marginTop: space[8] },
  header: { gap: space[1] },
  section: { gap: space[3] },
  flex: { flex: 1 },
  centered: { textAlign: 'center' },
  number: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.tint,
  },
  lesson: { gap: space[3], paddingBottom: space[4], paddingLeft: 48 },
  examTop: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  question: { gap: space[3] },
  options: { gap: space[2], marginTop: space[2] },
  option: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.md,
    borderWidth: borderWidth.hairline,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  optionSelected: {
    borderWidth: borderWidth.strong,
    borderColor: colors.ink,
    backgroundColor: colors.tint,
  },
  actions: { gap: space[2] },
  result: { justifyContent: 'center', alignItems: 'stretch' },
});
