import {
  getCaregiverMeGetQueryKey,
  getUsersMeQueryKey,
  useCaregiverMeCreate,
} from '@pawie/api-client';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Nimbus } from '@/components/Nimbus';
import { Row } from '@/components/Row';
import { Text } from '@/components/Text';
import { errorMessage, queryClient } from '@/lib/api';
import { HOME } from '@/lib/mode';
import { setMode } from '@/lib/session';
import { colors, gutter, radius, space } from '@/theme/tokens';

/** What Pawie asks to be a caregiver, in the order of the sign-up (RN-CUI-01 to RN-CUI-04). */
const ASKS: { icon: IconName; title: string; detail: string }[] = [
  {
    icon: 'id-card',
    title: 'Tus documentos',
    detail:
      'Tu DUI por los dos lados, una selfie y tu constancia de antecedentes penales o la solvencia de la PNC.',
  },
  {
    icon: 'book-open',
    title: 'El curso de bienvenida',
    detail: 'Gratis y en la app. Termina con un examen que puedes repetir.',
  },
  {
    icon: 'shield-check',
    title: 'La revisión de Pawie',
    detail: 'Verificamos tu identidad y tus antecedentes, y te damos esas insignias.',
  },
  {
    icon: 'map-pin',
    title: 'Tu perfil',
    detail: 'Eliges tus distritos, tu horario y tus precios, dentro del rango de tu nivel.',
  },
];

// CuiActivar (RN-CTA-06): from Cuenta, what being a caregiver takes and the button to start.
export default function ActivateCaregiverScreen() {
  const create = useCaregiverMeCreate({
    mutation: {
      onSuccess: (profile) => {
        queryClient.setQueryData(getCaregiverMeGetQueryKey(), profile);
        void queryClient.invalidateQueries({ queryKey: getUsersMeQueryKey() });
        // The API already saved caregiver mode in the account.
        setMode('CAREGIVER');
        router.dismissTo(HOME.CAREGIVER);
      },
    },
  });

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <IconButton icon="chevron-left" accessibilityLabel="Volver" onPress={() => router.back()} />
        <View style={styles.hero}>
          <Nimbus pose="hola" background="tint" size={88} />
          <Text variant="title" accessibilityRole="header" style={styles.centered}>
            Cuida mascotas con Pawie
          </Text>
          <Text color="inkMuted" style={styles.centered}>
            Tú pones tus precios dentro del rango de tu nivel, y tu nivel sube con tus reseñas, tus
            servicios y tus certificaciones.
          </Text>
        </View>

        <View>
          <Text variant="heading" accessibilityRole="header">
            Qué te pedimos
          </Text>
          {ASKS.map(({ icon, title, detail }, index) => (
            <Row key={title} divider={index > 0} style={styles.ask}>
              <View style={styles.askIcon}>
                <Icon name={icon} />
              </View>
              <View style={styles.flex}>
                <Text variant="subheading">{title}</Text>
                <Text variant="caption" color="inkMuted">
                  {detail}
                </Text>
              </View>
            </Row>
          ))}
        </View>

        <Text variant="caption" color="inkMuted">
          Tu cuenta de dueño sigue igual: cambias de modo desde Cuenta.
        </Text>
        {create.isError && <Banner tone="error" message={errorMessage(create.error)} />}
        <Button label="Empezar" loading={create.isPending} onPress={() => create.mutate()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    gap: space[6],
    paddingHorizontal: gutter,
    paddingTop: space[1],
    paddingBottom: space[8],
  },
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: space[3] },
  centered: { textAlign: 'center' },
  ask: { alignItems: 'flex-start' },
  askIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.tint,
  },
});
