import { zodResolver } from '@hookform/resolvers/zod';
import { usePetsAddVaccination } from '@pawie/api-client';
import { PetsAddVaccinationBody } from '@pawie/api-client/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Banner } from '@/components/Banner';
import { BottomBar } from '@/components/BottomBar';
import { Button } from '@/components/Button';
import { FormInput } from '@/components/FormInput';
import { FormScreen } from '@/components/FormScreen';
import { IconButton } from '@/components/IconButton';
import { errorMessage } from '@/lib/api';
import { localDate, maskDate, parseDate } from '@/lib/format';
import { petChanged } from '@/lib/pets';

const VaccinationFields = z
  .object({
    name: PetsAddVaccinationBody.shape.name.trim().min(1, 'Escribe el nombre de la vacuna.'),
    administeredOn: z
      .string()
      .refine((text) => parseDate(text) !== null, { message: 'Escribe la fecha como DD/MM/AAAA.' })
      .refine((text) => (parseDate(text) ?? '') <= localDate(new Date()), {
        message: 'La fecha no puede ser después de hoy.',
      }),
    nextDueOn: z.string().refine((text) => text === '' || parseDate(text) !== null, {
      message: 'Escribe la fecha como DD/MM/AAAA.',
    }),
  })
  .refine(
    ({ administeredOn, nextDueOn }) =>
      nextDueOn === '' || (parseDate(nextDueOn) ?? '') > (parseDate(administeredOn) ?? ''),
    { message: 'Tiene que ser después de la que ya le pusieron.', path: ['nextDueOn'] },
  );

type VaccinationValues = z.infer<typeof VaccinationFields>;

// MascotaPerfil, a new vaccine (RN-MAS-02). A vaccine is deleted from MascotaPerfil.
export default function NewVaccinationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const add = usePetsAddVaccination();
  const { control, handleSubmit } = useForm<VaccinationValues>({
    resolver: zodResolver(VaccinationFields),
    defaultValues: { name: '', administeredOn: '', nextDueOn: '' },
  });

  const submit = handleSubmit(({ name, administeredOn, nextDueOn }) =>
    add.mutate(
      {
        petId: id,
        data: {
          name,
          administeredOn: parseDate(administeredOn)!,
          nextDueOn: parseDate(nextDueOn) ?? undefined,
        },
      },
      {
        onSuccess: () => {
          petChanged(id);
          router.back();
        },
      },
    ),
  );

  return (
    <FormScreen
      title="Agregar vacuna"
      top={
        <IconButton icon="chevron-left" accessibilityLabel="Volver" onPress={() => router.back()} />
      }
      footer={
        <BottomBar>
          <Button label="Guardar" loading={add.isPending} onPress={() => submit()} />
        </BottomBar>
      }
    >
      <FormInput
        control={control}
        name="name"
        label="Vacuna"
        placeholder="Ej.: antirrábica"
        autoCapitalize="sentences"
      />
      <FormInput
        control={control}
        name="administeredOn"
        label="Cuándo se la pusieron"
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        mask={maskDate}
      />
      <FormInput
        control={control}
        name="nextDueOn"
        label="Siguiente dosis"
        optional
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        mask={maskDate}
      />
      {add.isError && <Banner tone="error" message={errorMessage(add.error)} />}
    </FormScreen>
  );
}
