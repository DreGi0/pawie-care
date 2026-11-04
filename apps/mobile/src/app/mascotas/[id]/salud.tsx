import { zodResolver } from '@hookform/resolvers/zod';
import { usePetsReplace, type PetDetail } from '@pawie/api-client';
import { PetsReplaceBody } from '@pawie/api-client/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Banner } from '@/components/Banner';
import { BottomBar } from '@/components/BottomBar';
import { Button } from '@/components/Button';
import { FormInput } from '@/components/FormInput';
import { FormScreen } from '@/components/FormScreen';
import { IconButton } from '@/components/IconButton';
import { PetLoader } from '@/components/PetLoader';
import { errorMessage } from '@/lib/api';
import { maskPhone, parsePhone } from '@/lib/format';
import { optionalText, petChanged, petRequest } from '@/lib/pets';

const HealthFields = z.object({
  vetName: PetsReplaceBody.shape.vetName.unwrap(),
  vetClinic: PetsReplaceBody.shape.vetClinic.unwrap(),
  vetPhone: z.string().refine((text) => text === '' || parsePhone(text) !== null, {
    message: 'Escribe los 8 dígitos del teléfono.',
  }),
  healthConditions: PetsReplaceBody.shape.healthConditions.unwrap(),
  medications: PetsReplaceBody.shape.medications.unwrap(),
});

type HealthValues = z.infer<typeof HealthFields>;

// MascotaPerfil, Salud (RN-MAS-02). The vaccines and the care tasks have their own screens.
export default function PetHealthScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PetLoader petId={id}>{(pet) => <HealthForm pet={pet} />}</PetLoader>;
}

function HealthForm({ pet }: { pet: PetDetail }) {
  const replace = usePetsReplace();
  const { control, handleSubmit } = useForm<HealthValues>({
    resolver: zodResolver(HealthFields),
    defaultValues: {
      vetName: pet.vetName ?? '',
      vetClinic: pet.vetClinic ?? '',
      vetPhone: maskPhone(pet.vetPhone?.replace(/^\+503/, '') ?? ''),
      healthConditions: pet.healthConditions ?? '',
      medications: pet.medications ?? '',
    },
  });

  const submit = handleSubmit((values) =>
    replace.mutate(
      {
        petId: pet.id,
        data: petRequest(pet, {
          vetName: optionalText(values.vetName),
          vetClinic: optionalText(values.vetClinic),
          vetPhone: parsePhone(values.vetPhone) ?? undefined,
          healthConditions: optionalText(values.healthConditions),
          medications: optionalText(values.medications),
        }),
      },
      {
        onSuccess: (saved) => {
          petChanged(pet.id, saved);
          router.back();
        },
      },
    ),
  );

  return (
    <FormScreen
      title="Salud"
      subtitle={`Lo que el cuidador tiene que saber de la salud de ${pet.name}.`}
      top={
        <IconButton icon="chevron-left" accessibilityLabel="Volver" onPress={() => router.back()} />
      }
      footer={
        <BottomBar>
          <Button label="Guardar" loading={replace.isPending} onPress={() => submit()} />
        </BottomBar>
      }
    >
      <FormInput
        control={control}
        name="vetName"
        label="Veterinario de cabecera"
        optional
        autoCapitalize="words"
        placeholder="Ej.: Dra. Rivas"
      />
      <FormInput
        control={control}
        name="vetClinic"
        label="Clínica"
        optional
        autoCapitalize="words"
        placeholder="Ej.: Clínica Veterinaria San Benito"
      />
      <FormInput
        control={control}
        name="vetPhone"
        label="Teléfono de la clínica"
        optional
        prefix="+503"
        keyboardType="phone-pad"
        placeholder="2222 0000"
        mask={maskPhone}
      />
      <FormInput
        control={control}
        name="healthConditions"
        label="Condiciones de salud"
        optional
        multiline
        placeholder="Ej.: artritis en las patas traseras"
        helper="Lo que tiene que hacer el cuidador va en las tareas de cuidado."
      />
      {/* RN-MAS-02: this text only informs. A medicine the caregiver gives is a Medicación care
          task with its doses (RN-CUI-12), or a caregiver without the ⭐ could end up giving it. */}
      <FormInput
        control={control}
        name="medications"
        label="Medicamentos que toma"
        optional
        multiline
        placeholder="Ej.: gotas para los ojos, se las pongo yo"
        helper="Si el cuidador tiene que dárselos, agrégalos como tarea de cuidado."
      />
      {replace.isError && <Banner tone="error" message={errorMessage(replace.error)} />}
    </FormScreen>
  );
}
