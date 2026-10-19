import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AddressForm } from '@/components/AddressForm';
import { FormScreen } from '@/components/FormScreen';
import { IconButton } from '@/components/IconButton';
import { StepBar } from '@/components/StepBar';
import { finishOnboarding } from '@/lib/session';
import { space } from '@/theme/tokens';

// Onboarding 2/2. Finishing it takes the new account to the tabs.
export default function OnboardingAddressScreen() {
  const { petName } = useLocalSearchParams<{ petName?: string }>();

  return (
    <FormScreen
      title={petName ? `¿Dónde vive ${petName}?` : '¿Dónde vive tu mascota?'}
      subtitle="Es donde tu cuidador hará las visitas."
      top={
        <View style={styles.top}>
          <IconButton
            icon="chevron-left"
            accessibilityLabel="Volver al paso 1"
            onPress={() => router.back()}
          />
          <View style={styles.step}>
            <StepBar current={2} total={2} />
          </View>
        </View>
      }
    >
      <AddressForm submitLabel="Buscar cuidadores" onSaved={finishOnboarding} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  step: { flex: 1 },
});
