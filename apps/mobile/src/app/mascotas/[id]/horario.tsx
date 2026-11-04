import { zodResolver } from '@hookform/resolvers/zod';
import {
  usePetsAddScheduleItem,
  usePetsRemoveScheduleItem,
  usePetsReplaceScheduleItem,
  type PetDetail,
  type ScheduleItemRequest,
} from '@pawie/api-client';
import { PetsAddScheduleItemBody } from '@pawie/api-client/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Banner } from '@/components/Banner';
import { BottomBar } from '@/components/BottomBar';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { FormInput } from '@/components/FormInput';
import { FormScreen } from '@/components/FormScreen';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { PetLoader } from '@/components/PetLoader';
import { Text } from '@/components/Text';
import { errorMessage } from '@/lib/api';
import { capitalize, formatDateSpan, maskTime, parseTime, toTimeInput } from '@/lib/format';
import { optionalText, petChanged } from '@/lib/pets';
import { space } from '@/theme/tokens';

const ScheduleFields = z
  .object({
    kind: z.enum(['MEAL', 'MEDICATION']),
    time: z.string().refine((text) => parseTime(text) !== null, {
      message: 'Escribe la hora como HH:MM, de 00:00 a 23:59.',
    }),
    label: PetsAddScheduleItemBody.shape.label.trim().min(1, 'Escribe qué es.'),
    dose: PetsAddScheduleItemBody.shape.dose.unwrap(),
    careNeedId: z.string(),
  })
  .refine(({ kind, careNeedId }) => kind === 'MEAL' || careNeedId !== '', {
    message: 'Elige la tarea de Medicación de esta medicina.',
    path: ['careNeedId'],
  });

type ScheduleValues = z.infer<typeof ScheduleFields>;

// MascotaPerfil, a meal or a medication dose at a time of day (RN-MAS-02). They're the tasks of
// each visit that fall in its hours (RN-MAS-12). A dose belongs to a Medicación care task, which
// gives its days and its vet instructions (RN-CUI-12).
export default function PetScheduleScreen() {
  const { id, itemId } = useLocalSearchParams<{ id: string; itemId?: string }>();
  return <PetLoader petId={id}>{(pet) => <ScheduleForm pet={pet} itemId={itemId} />}</PetLoader>;
}

function ScheduleForm({ pet, itemId }: { pet: PetDetail; itemId?: string }) {
  const add = usePetsAddScheduleItem();
  const replace = usePetsReplaceScheduleItem();
  const remove = usePetsRemoveScheduleItem();
  const save = itemId ? replace : add;
  const item = pet.scheduleItems.find(({ id }) => id === itemId);
  const medicationNeeds = pet.careNeeds.filter(({ task }) => task === 'MEDICATION');

  const onlyNeedId = medicationNeeds.length === 1 ? medicationNeeds[0].id : '';

  const { control, handleSubmit, getValues, setValue } = useForm<ScheduleValues>({
    resolver: zodResolver(ScheduleFields),
    defaultValues: {
      kind: item?.kind ?? 'MEAL',
      time: item ? toTimeInput(item.minuteOfDay) : '',
      label: item?.label ?? '',
      dose: item?.dose ?? '',
      careNeedId: item?.careNeedId ?? onlyNeedId,
    },
  });
  const kind = useWatch({ control, name: 'kind' });
  const medication = kind === 'MEDICATION';

  // Coming back from adding the first Medicación task, that task is the one.
  useEffect(() => {
    if (onlyNeedId && !getValues('careNeedId')) setValue('careNeedId', onlyNeedId);
  }, [onlyNeedId, getValues, setValue]);

  const done = () => {
    petChanged(pet.id);
    router.back();
  };
  const submit = handleSubmit(({ kind, time, label, dose, careNeedId }) => {
    const data: ScheduleItemRequest = {
      kind,
      minuteOfDay: parseTime(time)!,
      label,
      dose: optionalText(dose),
      careNeedId: kind === 'MEDICATION' ? careNeedId : undefined,
    };
    if (itemId)
      replace.mutate({ petId: pet.id, scheduleItemId: itemId, data }, { onSuccess: done });
    else add.mutate({ petId: pet.id, data }, { onSuccess: done });
  });
  const confirmRemove = () =>
    Alert.alert('¿Borrar este horario?', item?.label, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () =>
          remove.mutate(
            { petId: pet.id, scheduleItemId: itemId! },
            {
              onSuccess: done,
              onError: (error) => Alert.alert('No pudimos borrarlo', errorMessage(error)),
            },
          ),
      },
    ]);

  return (
    <FormScreen
      title={itemId ? 'Editar horario' : 'Agregar horario'}
      subtitle={`Una comida o una medicina de ${pet.name}, a su hora.`}
      top={
        <IconButton icon="chevron-left" accessibilityLabel="Volver" onPress={() => router.back()} />
      }
      footer={
        <BottomBar>
          <Button
            label="Guardar"
            loading={save.isPending}
            disabled={medication && medicationNeeds.length === 0}
            onPress={() => submit()}
          />
        </BottomBar>
      }
    >
      <Controller
        control={control}
        name="kind"
        render={({ field }) => (
          <Field label="Es una">
            <View style={styles.choices}>
              {(
                [
                  { value: 'MEAL', label: 'Comida', icon: 'utensils' },
                  { value: 'MEDICATION', label: 'Medicina', icon: 'pill' },
                ] as const
              ).map((option) => (
                <View key={option.value} style={styles.choice}>
                  <Chip
                    label={option.label}
                    icon={<Icon name={option.icon} size={20} />}
                    selected={field.value === option.value}
                    onPress={() => field.onChange(option.value)}
                  />
                </View>
              ))}
            </View>
          </Field>
        )}
      />

      {medication && (
        <Banner
          tone="info"
          message={`El cuidador se la da solo los días de su tarea de Medicación, con las indicaciones del veterinario. Por eso solo atienden a ${pet.name} cuidadores con la certificación ⭐.`}
        />
      )}

      {medication && medicationNeeds.length === 0 ? (
        <View style={styles.missing}>
          <Text color="inkMuted">
            Primero agrega la tarea de cuidado Medicación, con las indicaciones del veterinario.
          </Text>
          <Button
            variant="secondary"
            label="Agregar tarea de Medicación"
            onPress={() =>
              router.push({
                pathname: '/mascotas/[id]/tarea',
                params: { id: pet.id, task: 'MEDICATION' },
              })
            }
          />
        </View>
      ) : (
        <>
          {medication && (
            <Controller
              control={control}
              name="careNeedId"
              render={({ field, fieldState }) => (
                <Field label="Tarea de Medicación" error={fieldState.error?.message}>
                  <View style={styles.wrap}>
                    {medicationNeeds.map((need) => (
                      <Chip
                        key={need.id}
                        label={capitalize(formatDateSpan(need.startsOn, need.endsOn))}
                        selected={field.value === need.id}
                        onPress={() => field.onChange(need.id)}
                      />
                    ))}
                  </View>
                </Field>
              )}
            />
          )}
          <FormInput
            control={control}
            name="time"
            label="Hora"
            placeholder="07:00"
            keyboardType="number-pad"
            helper="En formato de 24 horas: 18:30 son las 6:30 de la tarde."
            mask={maskTime}
          />
          <FormInput
            control={control}
            name="label"
            label={medication ? 'Medicina' : 'Comida'}
            placeholder={medication ? 'Ej.: amoxicilina' : 'Ej.: desayuno'}
            autoCapitalize="sentences"
          />
          <FormInput
            control={control}
            name="dose"
            label={medication ? 'Dosis' : 'Porción'}
            optional
            placeholder={medication ? 'Ej.: media pastilla' : 'Ej.: 1 taza'}
            helper={
              !medication && pet.foodPortion
                ? `Si la dejas vacía, es la de siempre: ${pet.foodPortion}.`
                : undefined
            }
          />
        </>
      )}

      {save.isError && <Banner tone="error" message={errorMessage(save.error)} />}
      {itemId && (
        <Button
          variant="danger"
          label="Borrar horario"
          loading={remove.isPending}
          onPress={confirmRemove}
        />
      )}
    </FormScreen>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      {children}
      {error && (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space[2] },
  choices: { flexDirection: 'row', gap: space[2] },
  choice: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  missing: { gap: space[3] },
});
