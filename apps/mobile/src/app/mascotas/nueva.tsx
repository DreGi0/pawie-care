import { router } from 'expo-router';

import { ComingSoon } from '@/components/ComingSoon';

export default function NewPetScreen() {
  return <ComingSoon title="Agregar mascota" onBack={() => router.back()} />;
}
