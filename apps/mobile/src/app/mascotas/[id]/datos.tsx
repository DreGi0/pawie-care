import { router, useLocalSearchParams } from 'expo-router';

import { FormScreen } from '@/components/FormScreen';
import { IconButton } from '@/components/IconButton';
import { PetForm } from '@/components/PetForm';
import { PetLoader } from '@/components/PetLoader';

// MascotaPerfil, Datos (RN-MAS-02): the same form as "Agregar mascota", plus weight and whether
// it's sterilized. The rest of the profile stays as it is.
export default function PetDataScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <PetLoader petId={id}>
      {(pet) => (
        <FormScreen
          title="Datos"
          top={
            <IconButton
              icon="chevron-left"
              accessibilityLabel="Volver"
              onPress={() => router.back()}
            />
          }
        >
          <PetForm submitLabel="Guardar" pet={pet} onSaved={() => router.back()} />
        </FormScreen>
      )}
    </PetLoader>
  );
}
