import { zodResolver } from '@hookform/resolvers/zod';
import { usePetsReplace, type PetDetail, type PetRequest } from '@pawie/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Banner } from '@/components/Banner';
import { BottomBar } from '@/components/BottomBar';
import { Button } from '@/components/Button';
import { FormInput } from '@/components/FormInput';
import { FormScreen } from '@/components/FormScreen';
import { IconButton } from '@/components/IconButton';
import { PetLoader } from '@/components/PetLoader';
import { errorMessage } from '@/lib/api';
import { maskDate, parseDate, toDateInput } from '@/lib/format';
import { petChanged, petRequest } from '@/lib/pets';
import { space } from '@/theme/tokens';

const date = z
  .string()
  .refine((text) => parseDate(text) !== null, { message: 'Escribe la fecha como DD/MM/AAAA.' });

const HeatFields = z
  .object({ startsOn: date, endsOn: date })
  .refine(({ startsOn, endsOn }) => (parseDate(endsOn) ?? '') >= (parseDate(startsOn) ?? ''), {
    message: 'El último día no puede ser antes del primero.',
    path: ['endsOn'],
  });

type HeatValues = z.infer<typeof HeatFields>;

// MascotaPerfil, Celo (RN-MAS-11): only for females. MascotaPerfil doesn't open it for a male.
export default function PetHeatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PetLoader petId={id}>{(pet) => <HeatForm pet={pet} />}</PetLoader>;
}

function HeatForm({ pet }: { pet: PetDetail }) {
  const replace = usePetsReplace();
  const { control, handleSubmit } = useForm<HeatValues>({
    resolver: zodResolver(HeatFields),
    defaultValues: {
      startsOn: pet.heatStartsOn ? toDateInput(pet.heatStartsOn) : '',
      endsOn: pet.heatEndsOn ? toDateInput(pet.heatEndsOn) : '',
    },
  });

  const save = (heat: Pick<PetRequest, 'heatStartsOn' | 'heatEndsOn'>) =>
    replace.mutate(
      { petId: pet.id, data: petRequest(pet, heat) },
      {
        onSuccess: (saved) => {
          petChanged(pet.id, saved);
          router.back();
        },
      },
    );
  const submit = handleSubmit(({ startsOn, endsOn }) =>
    save({ heatStartsOn: parseDate(startsOn)!, heatEndsOn: parseDate(endsOn)! }),
  );

  return (
    <FormScreen
      title="Celo"
      subtitle={`Los días en que ${pet.name} está en celo, los dos incluidos.`}
      top={
        <IconButton icon="chevron-left" accessibilityLabel="Volver" onPress={() => router.back()} />
      }
      footer={
        <BottomBar>
          <Button label="Guardar" loading={replace.isPending} onPress={() => submit()} />
        </BottomBar>
      }
    >
      <Banner
        tone="info"
        message="No cambia el precio ni quién puede cuidarla. El cuidador lo ve antes de aceptar y sabe cómo atenderla sin aislarla."
      />
      <View style={styles.dates}>
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
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          mask={maskDate}
        />
      </View>
      {replace.isError && <Banner tone="error" message={errorMessage(replace.error)} />}
      {pet.heatStartsOn && (
        <Button
          variant="danger"
          label="Quitar el celo"
          disabled={replace.isPending}
          onPress={() => save({ heatStartsOn: undefined, heatEndsOn: undefined })}
        />
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  dates: { gap: space[4] },
});
