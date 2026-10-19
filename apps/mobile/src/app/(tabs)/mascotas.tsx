import { usePetsList, type PetResponse } from '@pawie/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { describePet } from '@/lib/pets';
import { colors, radius, space } from '@/theme/tokens';

// No mockup: built from the design system. It doesn't show the care level, because it
// depends on the dates of each service (RN-MAS-05) and only the API computes it.
export default function PetsScreen() {
  const pets = usePetsList();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await pets.refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={[colors.grapeDeep]}
            tintColor={colors.grapeDeep}
          />
        }
      >
        <Text variant="title">Mis mascotas</Text>
        {pets.isPending ? (
          <ActivityIndicator color={colors.grapeDeep} style={styles.loading} />
        ) : pets.isError ? (
          <>
            <Banner
              tone="error"
              message="No pudimos cargar tus mascotas. Revisa tu conexión e intenta de nuevo."
            />
            <Button label="Reintentar" onPress={() => pets.refetch()} />
          </>
        ) : pets.data.length === 0 ? (
          <NoPets />
        ) : (
          <>
            {pets.data.map((pet) => (
              <PetCard key={pet.id} pet={pet} />
            ))}
            <AddPetButton />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PetCard({ pet }: { pet: PetResponse }) {
  return (
    <Card style={styles.pet}>
      <Avatar name={pet.name} photoUrl={pet.photoUrl} />
      <View style={styles.petText}>
        <Text variant="bodyStrong">{pet.name}</Text>
        <Text variant="caption" color="inkMuted">
          {describePet(pet)}
        </Text>
      </View>
    </Card>
  );
}

function NoPets() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyArt}>
        <Icon name="paw-print" size={64} />
      </View>
      <View style={styles.emptyText}>
        <Text variant="heading" style={styles.centered}>
          Aún no tienes mascotas
        </Text>
        <Text color="inkMuted" style={styles.centered}>
          Agrega a tu perro o gato para buscarle cuidador.
        </Text>
      </View>
      <AddPetButton />
    </View>
  );
}

function AddPetButton() {
  return <Button label="Agregar mascota" onPress={() => router.push('/mascotas/nueva')} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { flexGrow: 1, gap: space[4], padding: space[4], paddingTop: space[6] },
  loading: { marginTop: space[8] },
  pet: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  petText: { flex: 1 },
  empty: { flexGrow: 1, justifyContent: 'center', gap: space[4] },
  emptyArt: {
    alignSelf: 'center',
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.sky,
  },
  emptyText: { gap: space[1] },
  centered: { textAlign: 'center' },
});
