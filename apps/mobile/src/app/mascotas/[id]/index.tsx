import {
  useCatalogGet,
  usePetsRemoveVaccination,
  type CareNeedResponse,
  type PetDetail,
  type ScheduleItemResponse,
  type VaccinationResponse,
} from '@pawie/api-client';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { PetLoader } from '@/components/PetLoader';
import { Row } from '@/components/Row';
import { Text } from '@/components/Text';
import { errorMessage } from '@/lib/api';
import { capitalize, formatDate, formatDateSpan, formatMinute, formatPhone } from '@/lib/format';
import { describeBody, describePet, petChanged } from '@/lib/pets';
import { colors, gutter, space } from '@/theme/tokens';

// MascotaPerfil (RN-MAS-02, RN-MAS-11): the whole profile, by parts, each with its own edit
// screen. Its actions are all "Editar" or "Agregar", so it has no primary button.
export default function PetProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PetLoader petId={id}>{(pet) => <PetProfile pet={pet} />}</PetLoader>;
}

function PetProfile({ pet }: { pet: PetDetail }) {
  const catalog = useCatalogGet();
  const removeVaccination = usePetsRemoveVaccination();
  const taskName = (need: CareNeedResponse) =>
    catalog.data?.careTasks.find(({ code }) => code === need.task)?.name ?? '';
  // RN-MAS-08: what backs each task, the vet's document or the owner's words.
  const instructionsOf = (need: CareNeedResponse) => {
    const document = pet.vetInstructions.find(({ id }) => id === need.vetInstructionId);
    return document
      ? `Indicaciones del veterinario del ${formatDate(document.issuedOn)}`
      : need.ownerInstructions;
  };
  const open = (part: string, params: Record<string, string> = {}) =>
    router.push({ pathname: `/mascotas/[id]/${part}`, params: { id: pet.id, ...params } } as Href);

  const routine = [
    { label: 'Alimento', value: pet.foodDescription },
    { label: 'Porción', value: pet.foodPortion },
    { label: 'Premios permitidos', value: pet.allowedTreats },
    { label: 'Rutina diaria', value: pet.dailyRoutine },
    { label: 'Temperamento', value: pet.temperament },
    { label: 'Notas de manejo', value: pet.handlingNotes },
  ];
  const vet = [pet.vetName, pet.vetClinic, pet.vetPhone && formatPhone(pet.vetPhone)]
    .filter(Boolean)
    .join(', ');
  const health = [
    { label: 'Veterinario de cabecera', value: vet },
    { label: 'Condiciones de salud', value: pet.healthConditions },
    { label: 'Medicamentos que toma', value: pet.medications },
  ];

  const confirmRemoveVaccination = (vaccination: VaccinationResponse) =>
    Alert.alert(`¿Borrar ${vaccination.name}?`, 'La vacuna sale de su ficha.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () =>
          removeVaccination.mutate(
            { petId: pet.id, vaccinationId: vaccination.id },
            {
              onSuccess: () => petChanged(pet.id),
              onError: (error) => Alert.alert('No pudimos borrarla', errorMessage(error)),
            },
          ),
      },
    ]);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <IconButton icon="chevron-left" accessibilityLabel="Volver" onPress={() => router.back()} />

        <View style={styles.hero}>
          <Avatar name={pet.name} photoUrl={pet.photoUrl} size={96} />
          <View style={styles.heroText}>
            <Text variant="title" accessibilityRole="header">
              {pet.name}
            </Text>
            <Text color="inkMuted">{describePet(pet)}</Text>
            <Text variant="caption" color="inkMuted">
              {describeBody(pet)}
            </Text>
          </View>
        </View>
        <Button variant="secondary" label="Editar datos" onPress={() => open('datos')} />

        <Section
          title="Rutina"
          action={{ label: 'Editar', onPress: () => open('rutina') }}
          empty={routine.every(({ value }) => !value)}
          emptyText="Cuéntale al cuidador qué come, qué premios puede darle y cómo es su día."
        >
          <Facts facts={routine} />
        </Section>

        <Section
          title="Horarios de comida y medicinas"
          action={{ label: 'Agregar', onPress: () => open('horario') }}
          empty={pet.scheduleItems.length === 0}
          emptyText="Agrega a qué hora come. El cuidador ve las comidas y las medicinas que caen en su visita."
        >
          {pet.scheduleItems.map((item, index) => (
            <ScheduleRow
              key={item.id}
              item={item}
              pet={pet}
              divider={index > 0}
              onPress={() => open('horario', { itemId: item.id })}
            />
          ))}
        </Section>

        <Section
          title="Salud"
          action={{ label: 'Editar', onPress: () => open('salud') }}
          empty={health.every(({ value }) => !value)}
          emptyText="Su veterinario de cabecera y sus condiciones de salud."
        >
          <Facts facts={health} />
        </Section>

        <Section
          title="Vacunas"
          level="subheading"
          action={{ label: 'Agregar', onPress: () => open('vacuna') }}
          empty={pet.vaccinations.length === 0}
          emptyText="Sin vacunas registradas."
        >
          {pet.vaccinations.map((vaccination, index) => (
            <Row
              key={vaccination.id}
              divider={index > 0}
              onPress={() => confirmRemoveVaccination(vaccination)}
              accessibilityLabel={`${vaccination.name}. Toca para borrarla.`}
            >
              <View style={styles.flex}>
                <Text variant="bodyStrong">{vaccination.name}</Text>
                <Text variant="caption" color="inkMuted">
                  {`Aplicada el ${formatDate(vaccination.administeredOn)}`}
                  {vaccination.nextDueOn &&
                    `. La siguiente, el ${formatDate(vaccination.nextDueOn)}`}
                </Text>
              </View>
              <Icon name="x" color="inkMuted" />
            </Row>
          ))}
        </Section>

        <Section
          title="Tareas de cuidado"
          action={{ label: 'Agregar', onPress: () => open('tarea') }}
          caption={`Mientras una tarea esté activa, solo atienden a ${pet.name} cuidadores con la certificación ⭐.`}
          empty={pet.careNeeds.length === 0}
          emptyText="¿Toma medicina, se recupera de una operación o necesita ayuda para moverse? Agrégalo aquí."
        >
          {pet.careNeeds.map((need, index) => (
            <Row
              key={need.id}
              divider={index > 0}
              onPress={() => open('tarea', { careNeedId: need.id })}
            >
              <View style={styles.flex}>
                <Text variant="bodyStrong">{taskName(need)}</Text>
                <Text variant="caption" color="inkMuted">
                  {capitalize(formatDateSpan(need.startsOn, need.endsOn))}
                </Text>
                {instructionsOf(need) && (
                  <Text variant="caption" color="inkMuted" numberOfLines={2}>
                    {instructionsOf(need)}
                  </Text>
                )}
                {need.group === 'PROHIBITED' && (
                  <Text variant="caption" color="danger">
                    {`Ningún cuidador puede hacerla: mientras dure, no puedes reservar para ${pet.name}.`}
                  </Text>
                )}
              </View>
              <Icon name="chevron-right" color="inkMuted" />
            </Row>
          ))}
        </Section>

        {pet.sex === 'FEMALE' && (
          <Section
            title="Celo"
            action={{
              label: pet.heatStartsOn ? 'Editar' : 'Marcar celo',
              onPress: () => open('celo'),
            }}
            caption="No cambia el precio ni quién puede cuidarla. El cuidador lo ve antes de aceptar."
            empty={!pet.heatStartsOn}
            emptyText="No está en celo."
          >
            {pet.heatStartsOn && (
              <Row>
                <Text variant="bodyStrong">
                  {capitalize(formatDateSpan(pet.heatStartsOn, pet.heatEndsOn))}
                </Text>
              </Row>
            )}
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  level = 'heading',
  action,
  caption,
  empty,
  emptyText,
  children,
}: {
  title: string;
  level?: 'heading' | 'subheading';
  action: { label: string; onPress: () => void };
  caption?: string;
  empty: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text variant={level} accessibilityRole="header" style={styles.flex}>
          {title}
        </Text>
        <Button
          variant="ghost"
          label={action.label}
          accessibilityLabel={`${action.label}: ${title}`}
          onPress={action.onPress}
        />
      </View>
      {caption && (
        <Text variant="caption" color="inkMuted">
          {caption}
        </Text>
      )}
      {empty ? <Text color="inkMuted">{emptyText}</Text> : <View>{children}</View>}
    </View>
  );
}

/** The fields that have something, one per row: the label small and the value under it. */
function Facts({ facts }: { facts: { label: string; value: string | null }[] }) {
  return facts
    .filter((fact): fact is { label: string; value: string } => Boolean(fact.value))
    .map(({ label, value }, index) => (
      <Row key={label} divider={index > 0}>
        <View style={styles.flex}>
          <Text variant="caption" color="inkMuted">
            {label}
          </Text>
          <Text>{value}</Text>
        </View>
      </Row>
    ));
}

function ScheduleRow({
  item,
  pet,
  divider,
  onPress,
}: {
  item: ScheduleItemResponse;
  pet: PetDetail;
  divider: boolean;
  onPress: () => void;
}) {
  const medication = item.kind === 'MEDICATION';
  // A dose lasts as long as its Medicación task (RN-CUI-12).
  const need = pet.careNeeds.find(({ id }) => id === item.careNeedId);
  const detail = medication
    ? [item.dose, need && formatDateSpan(need.startsOn, need.endsOn)]
    : [item.dose ?? pet.foodPortion];

  return (
    <Row divider={divider} onPress={onPress}>
      <Text variant="subheading" style={styles.time}>
        {formatMinute(item.minuteOfDay)}
      </Text>
      <Icon name={medication ? 'pill' : 'utensils'} color="inkMuted" />
      <View style={styles.flex}>
        <Text variant="bodyStrong">{item.label}</Text>
        {detail.some(Boolean) && (
          <Text variant="caption" color="inkMuted">
            {capitalize(detail.filter(Boolean).join(', '))}
          </Text>
        )}
      </View>
      <Icon name="chevron-right" color="inkMuted" />
    </Row>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    gap: space[6],
    paddingHorizontal: gutter,
    paddingTop: space[1],
    paddingBottom: space[8],
  },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  heroText: { flex: 1, gap: 2 },
  section: { gap: space[1] },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  flex: { flex: 1, gap: 2 },
  time: { width: 56 },
});
