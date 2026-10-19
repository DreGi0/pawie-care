import { router } from 'expo-router';

import { FormScreen } from '@/components/FormScreen';
import { IconButton } from '@/components/IconButton';
import { PetForm } from '@/components/PetForm';

export default function NewPetScreen() {
  return (
    <FormScreen
      title="Agregar mascota"
      subtitle="Así te mostramos cuidadores que pueden atenderla."
      top={
        <IconButton icon="chevron-left" accessibilityLabel="Volver" onPress={() => router.back()} />
      }
    >
      <PetForm submitLabel="Guardar mascota" onSaved={() => router.back()} />
    </FormScreen>
  );
}
