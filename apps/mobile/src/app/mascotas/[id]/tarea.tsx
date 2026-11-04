import { zodResolver } from '@hookform/resolvers/zod';
import {
  useCatalogGet,
  usePetsAddCareNeed,
  usePetsAddVetInstruction,
  usePetsRemoveCareNeed,
  usePetsReplaceCareNeed,
  type CareNeedRequest,
  type CareTask,
  type CareTaskOption,
  type PetDetail,
} from '@pawie/api-client';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Banner } from '@/components/Banner';
import { BottomBar } from '@/components/BottomBar';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { FormInput } from '@/components/FormInput';
import { FormScreen } from '@/components/FormScreen';
import { IconButton } from '@/components/IconButton';
import { PetLoader } from '@/components/PetLoader';
import { Select } from '@/components/Select';
import { Text } from '@/components/Text';
import { errorMessage } from '@/lib/api';
import { uploadFile } from '@/lib/files';
import { formatDate, localDate, maskDate, parseDate, toDateInput } from '@/lib/format';
import { optionalText, petChanged } from '@/lib/pets';
import { space } from '@/theme/tokens';

/** The vet instructions that are being uploaded with this task, in place of an existing one. */
const NEW_INSTRUCTIONS = 'new';

const TaskObject = z.object({
  /** A CareTask, or empty until one is picked. */
  task: z.string(),
  startsOn: z.string(),
  endsOn: z.string(),
  /** An id from the pet's vet instructions, NEW_INSTRUCTIONS or empty. */
  vetInstructionId: z.string(),
  /** The date written on the new document. */
  issuedOn: z.string(),
  ownerInstructions: z.string().max(2000),
});

type TaskValues = z.infer<typeof TaskObject>;

/**
 * What each task asks for comes from GET /v1/catalog (RN-MAS-08), so the app doesn't keep its
 * own copy of the groups. The API checks it all again.
 */
function taskFields(careTasks: readonly CareTaskOption[]) {
  const dateMessage = 'Escribe la fecha como DD/MM/AAAA.';
  return TaskObject.superRefine((values, context) => {
    const issue = (path: keyof TaskValues, message: string) =>
      context.addIssue({ code: 'custom', path: [path], message });
    const option = careTasks.find(({ code }) => code === values.task);
    if (!option) return issue('task', 'Elige una tarea.');

    const startsOn = parseDate(values.startsOn);
    if (!startsOn) issue('startsOn', dateMessage);
    if (values.endsOn === '') {
      if (!option.canBeOpenEnded) issue('endsOn', 'Indica el último día.');
    } else if (!parseDate(values.endsOn)) {
      issue('endsOn', dateMessage);
    } else if (startsOn && parseDate(values.endsOn)! < startsOn) {
      issue('endsOn', 'El último día no puede ser antes del primero.');
    }

    if (option.group === 'CLINICAL') {
      if (values.vetInstructionId === '') {
        issue('vetInstructionId', 'Elige o sube las indicaciones del veterinario.');
      } else if (values.vetInstructionId === NEW_INSTRUCTIONS) {
        const issuedOn = parseDate(values.issuedOn);
        if (!issuedOn) issue('issuedOn', dateMessage);
        else if (issuedOn > localDate(new Date())) {
          issue('issuedOn', 'La fecha no puede ser después de hoy.');
        }
      }
    }
    if (option.group === 'ASSISTANCE' && values.ownerInstructions.trim() === '') {
      issue('ownerInstructions', 'Escribe cómo hacerla.');
    }
  });
}

// MascotaPerfil, a care task (RN-MAS-06, RN-MAS-08, RN-MAS-09): clinical ones need the vet's
// written instructions, assistance ones the owner's. A prohibited one blocks booking while it
// lasts.
export default function PetCareTaskScreen() {
  const { id, careNeedId, task } = useLocalSearchParams<{
    id: string;
    careNeedId?: string;
    task?: CareTask;
  }>();
  const catalog = useCatalogGet();

  return (
    <PetLoader petId={id}>
      {(pet) =>
        catalog.data ? (
          <TaskForm
            pet={pet}
            careTasks={catalog.data.careTasks}
            careNeedId={careNeedId}
            initialTask={task}
          />
        ) : null
      }
    </PetLoader>
  );
}

function TaskForm({
  pet,
  careTasks,
  careNeedId,
  initialTask,
}: {
  pet: PetDetail;
  careTasks: readonly CareTaskOption[];
  careNeedId?: string;
  initialTask?: CareTask;
}) {
  const addInstruction = usePetsAddVetInstruction();
  const add = usePetsAddCareNeed();
  const replace = usePetsReplaceCareNeed();
  const remove = usePetsRemoveCareNeed();
  const save = careNeedId ? replace : add;
  const need = pet.careNeeds.find(({ id }) => id === careNeedId);
  const doses = pet.scheduleItems.filter((item) => item.careNeedId === careNeedId).length;
  const [upload, setUpload] = useState<{ fileId: string; name: string } | 'uploading' | null>(null);
  const [uploadError, setUploadError] = useState(false);

  const { control, handleSubmit, setValue } = useForm<TaskValues>({
    resolver: zodResolver(taskFields(careTasks)),
    defaultValues: {
      task: need?.task ?? initialTask ?? '',
      startsOn: need ? toDateInput(need.startsOn) : '',
      endsOn: need?.endsOn ? toDateInput(need.endsOn) : '',
      vetInstructionId: need?.vetInstructionId ?? '',
      issuedOn: '',
      ownerInstructions: need?.ownerInstructions ?? '',
    },
  });
  const task = useWatch({ control, name: 'task' });
  const option = careTasks.find(({ code }) => code === task);

  const pickInstructions = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      // Its copy in the cache lands outside what expo-file-system may read in Expo Go.
      copyToCacheDirectory: false,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;

    setUpload('uploading');
    setUploadError(false);
    try {
      const fileId = await uploadFile(
        asset.uri,
        asset.mimeType ?? 'application/pdf',
        'VET_INSTRUCTION',
      );
      setUpload({ fileId, name: asset.name });
      setValue('vetInstructionId', NEW_INSTRUCTIONS, { shouldValidate: true });
    } catch {
      setUpload(null);
      setUploadError(true);
    }
  };

  const done = () => {
    petChanged(pet.id);
    router.back();
  };
  const submit = handleSubmit(async (values) => {
    const group = careTasks.find(({ code }) => code === values.task)!.group;
    let vetInstructionId = group === 'CLINICAL' ? values.vetInstructionId : undefined;
    if (vetInstructionId === NEW_INSTRUCTIONS && typeof upload === 'object' && upload) {
      try {
        const instruction = await addInstruction.mutateAsync({
          petId: pet.id,
          data: { fileId: upload.fileId, issuedOn: parseDate(values.issuedOn)! },
        });
        // If saving the task fails, trying again doesn't upload the document twice.
        vetInstructionId = instruction.id;
        setValue('vetInstructionId', instruction.id);
        setUpload(null);
        petChanged(pet.id);
      } catch {
        return;
      }
    }
    const data: CareNeedRequest = {
      task: values.task as CareTask,
      startsOn: parseDate(values.startsOn)!,
      endsOn: parseDate(values.endsOn) ?? undefined,
      vetInstructionId,
      ownerInstructions:
        group === 'ASSISTANCE' ? optionalText(values.ownerInstructions) : undefined,
    };
    if (careNeedId) replace.mutate({ petId: pet.id, careNeedId, data }, { onSuccess: done });
    else add.mutate({ petId: pet.id, data }, { onSuccess: done });
  });

  const confirmRemove = () =>
    Alert.alert(
      '¿Borrar esta tarea?',
      doses > 0
        ? doses === 1
          ? 'También se borra su horario de medicina.'
          : `También se borran sus ${doses} horarios de medicina.`
        : undefined,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: () =>
            remove.mutate(
              { petId: pet.id, careNeedId: careNeedId! },
              {
                onSuccess: done,
                onError: (error) => Alert.alert('No pudimos borrarla', errorMessage(error)),
              },
            ),
        },
      ],
    );

  const error = addInstruction.error ?? save.error;

  return (
    <FormScreen
      title={careNeedId ? 'Editar tarea de cuidado' : 'Agregar tarea de cuidado'}
      subtitle={`Lo que el cuidador tendría que hacer por ${pet.name}, y entre qué días.`}
      top={
        <IconButton icon="chevron-left" accessibilityLabel="Volver" onPress={() => router.back()} />
      }
      footer={
        <BottomBar>
          <Button
            label="Guardar"
            loading={save.isPending || addInstruction.isPending}
            disabled={upload === 'uploading'}
            onPress={() => submit()}
          />
        </BottomBar>
      }
    >
      <Controller
        control={control}
        name="task"
        render={({ field, fieldState }) => (
          <Select
            label="Tarea"
            placeholder="Elige una tarea"
            value={field.value || null}
            options={careTasks.map(({ code, name }) => ({ value: code, label: name }))}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />

      {option?.group === 'PROHIBITED' ? (
        <Banner
          tone="warning"
          message={`Ningún cuidador de Pawie puede hacer esto. Mientras la tarea dure, no podrás reservar para ${pet.name}.`}
        />
      ) : (
        option && (
          <Banner
            tone="info"
            message={`Mientras la tarea dure, solo atienden a ${pet.name} cuidadores con la certificación ⭐.`}
          />
        )
      )}

      <FormInput
        control={control}
        name="startsOn"
        label="Primer día"
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        mask={maskDate}
      />
      <FormInput
        control={control}
        name="endsOn"
        label="Último día"
        optional={option?.canBeOpenEnded}
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        helper={option?.canBeOpenEnded ? 'Déjalo vacío si no tiene fin.' : undefined}
        mask={maskDate}
      />

      {option?.group === 'CLINICAL' && (
        <Controller
          control={control}
          name="vetInstructionId"
          render={({ field, fieldState }) => (
            <Field
              label="Indicaciones del veterinario"
              helper="La receta o las instrucciones escritas, en foto o PDF."
              error={fieldState.error?.message}
            >
              {pet.vetInstructions.length > 0 && (
                <View style={styles.wrap}>
                  {pet.vetInstructions.map((instruction) => (
                    <Chip
                      key={instruction.id}
                      label={[`Del ${formatDate(instruction.issuedOn)}`, instruction.vetName]
                        .filter(Boolean)
                        .join(', ')}
                      selected={field.value === instruction.id}
                      onPress={() => field.onChange(instruction.id)}
                    />
                  ))}
                </View>
              )}
              {typeof upload === 'object' && upload ? (
                <Chip
                  label={upload.name}
                  selected={field.value === NEW_INSTRUCTIONS}
                  onPress={() => field.onChange(NEW_INSTRUCTIONS)}
                />
              ) : (
                <Button
                  variant="secondary"
                  label="Subir indicaciones"
                  loading={upload === 'uploading'}
                  onPress={pickInstructions}
                />
              )}
            </Field>
          )}
        />
      )}
      {uploadError && (
        <Banner tone="error" message="No pudimos subir el documento. Intenta con otro." />
      )}
      {option?.group === 'CLINICAL' && typeof upload === 'object' && upload && (
        <FormInput
          control={control}
          name="issuedOn"
          label="Fecha del documento"
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          helper="La que escribió el veterinario."
          mask={maskDate}
        />
      )}

      {option?.group === 'ASSISTANCE' && (
        <FormInput
          control={control}
          name="ownerInstructions"
          label="Cómo hacerla"
          multiline
          placeholder="Ej.: levantarla por el pecho y las patas traseras, nunca por el abdomen"
          helper="El cuidador sigue tus instrucciones al pie de la letra."
        />
      )}

      {error && <Banner tone="error" message={errorMessage(error)} />}
      {careNeedId && (
        <Button
          variant="danger"
          label="Borrar tarea"
          loading={remove.isPending}
          onPress={confirmRemove}
        />
      )}
    </FormScreen>
  );
}

function Field({
  label,
  helper,
  error,
  children,
}: {
  label: string;
  helper?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      {helper && (
        <Text variant="caption" color="inkMuted">
          {helper}
        </Text>
      )}
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
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
