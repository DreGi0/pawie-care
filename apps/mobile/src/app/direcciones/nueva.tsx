import { router } from 'expo-router';

import { AddressForm } from '@/components/AddressForm';
import { FormScreen } from '@/components/FormScreen';
import { IconButton } from '@/components/IconButton';

export default function NewAddressScreen() {
  return (
    <FormScreen
      title="Agregar dirección"
      subtitle="Es donde tu cuidador hará las visitas."
      top={
        <IconButton icon="chevron-left" accessibilityLabel="Volver" onPress={() => router.back()} />
      }
    >
      <AddressForm submitLabel="Guardar dirección" onSaved={() => router.back()} />
    </FormScreen>
  );
}
