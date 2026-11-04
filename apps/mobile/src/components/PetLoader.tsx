import { usePetsGet, type PetDetail } from '@pawie/api-client';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/lib/api';
import { colors, gutter, space } from '@/theme/tokens';

import { Banner } from './Banner';
import { IconButton } from './IconButton';

export type PetLoaderProps = {
  petId: string;
  /** The screen, once the pet is loaded. */
  children: (pet: PetDetail) => ReactNode;
};

/**
 * Loads a pet for MascotaPerfil and its edit screens. Until it arrives, it shows the back button
 * and a spinner, or the error.
 */
export function PetLoader({ petId, children }: PetLoaderProps) {
  const pet = usePetsGet(petId);

  if (pet.data) return children(pet.data);
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <IconButton icon="chevron-left" accessibilityLabel="Volver" onPress={() => router.back()} />
        {pet.isError ? (
          <Banner tone="error" message={errorMessage(pet.error)} />
        ) : (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { gap: space[4], paddingHorizontal: gutter, paddingTop: space[1] },
  loading: { marginTop: space[8] },
});
