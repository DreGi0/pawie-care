import { router } from 'expo-router';
import { useState } from 'react';

import { FormScreen } from '@/components/FormScreen';
import { PetForm } from '@/components/PetForm';
import { StepBar } from '@/components/StepBar';

// Onboarding 1/2. Coming back from step 2 saves over the same pet instead of adding another.
export default function OnboardingPetScreen() {
  const [petId, setPetId] = useState<string>();

  return (
    <FormScreen
      title="Cuéntanos de tu mascota"
      subtitle="Así te mostramos cuidadores que pueden atenderla."
      top={<StepBar current={1} total={2} />}
    >
      <PetForm
        submitLabel="Continuar"
        petId={petId}
        onSaved={(pet) => {
          setPetId(pet.id);
          router.push({ pathname: '/onboarding/direccion', params: { petName: pet.name } });
        }}
      />
    </FormScreen>
  );
}
