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
import { optionalText, petChanged, petRequest } from '@/lib/pets';

const RoutineFields = z.object({
  foodDescription: PetsReplaceBody.shape.foodDescription.unwrap(),
  foodPortion: PetsReplaceBody.shape.foodPortion.unwrap(),
  allowedTreats: PetsReplaceBody.shape.allowedTreats.unwrap(),
  dailyRoutine: PetsReplaceBody.shape.dailyRoutine.unwrap(),
  temperament: PetsReplaceBody.shape.temperament.unwrap(),
  handlingNotes: PetsReplaceBody.shape.handlingNotes.unwrap(),
});

type RoutineValues = z.infer<typeof RoutineFields>;

// MascotaPerfil, Rutina (RN-MAS-02): what the pet eats and how its day goes.
export default function PetRoutineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PetLoader petId={id}>{(pet) => <RoutineForm pet={pet} />}</PetLoader>;
}

function RoutineForm({ pet }: { pet: PetDetail }) {
  const replace = usePetsReplace();
  const { control, handleSubmit } = useForm<RoutineValues>({
    resolver: zodResolver(RoutineFields),
    defaultValues: {
      foodDescription: pet.foodDescription ?? '',
      foodPortion: pet.foodPortion ?? '',
      allowedTreats: pet.allowedTreats ?? '',
      dailyRoutine: pet.dailyRoutine ?? '',
      temperament: pet.temperament ?? '',
      handlingNotes: pet.handlingNotes ?? '',
    },
  });

  const submit = handleSubmit((values) =>
    replace.mutate(
      {
        petId: pet.id,
        data: petRequest(pet, {
          foodDescription: optionalText(values.foodDescription),
          foodPortion: optionalText(values.foodPortion),
          allowedTreats: optionalText(values.allowedTreats),
          dailyRoutine: optionalText(values.dailyRoutine),
          temperament: optionalText(values.temperament),
          handlingNotes: optionalText(values.handlingNotes),
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
      title="Rutina"
      subtitle={`Lo que come ${pet.name} y cómo es su día. El cuidador lo sigue tal cual.`}
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
        name="foodDescription"
        label="Alimento"
        optional
        placeholder="Ej.: croquetas para perro adulto, de cordero"
        helper="La marca o el tipo. Tú dejas el alimento: el cuidador no lo compra ni lo cambia."
      />
      <FormInput
        control={control}
        name="foodPortion"
        label="Porción"
        optional
        placeholder="Ej.: 1 taza por comida"
      />
      <FormInput
        control={control}
        name="allowedTreats"
        label="Premios permitidos"
        optional
        placeholder="Ej.: galletas de pollo, hasta 3 al día"
      />
      <FormInput
        control={control}
        name="dailyRoutine"
        label="Rutina diaria"
        optional
        multiline
        placeholder="Ej.: sale al patio al despertar y duerme en su cama de la sala"
      />
      <FormInput
        control={control}
        name="temperament"
        label="Temperamento"
        optional
        placeholder="Ej.: juguetón y sociable"
      />
      <FormInput
        control={control}
        name="handlingNotes"
        label="Notas de manejo"
        optional
        multiline
        placeholder="Ej.: jala la correa; se asusta con los cohetes"
      />
      {replace.isError && <Banner tone="error" message={errorMessage(replace.error)} />}
    </FormScreen>
  );
}
