import { useUsersMe, type AppMode } from '@pawie/api-client';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { Row } from '@/components/Row';
import { Text } from '@/components/Text';
import { errorMessage } from '@/lib/api';
import { switchMode } from '@/lib/mode';
import { signOut, useMode } from '@/lib/session';
import { colors, space } from '@/theme/tokens';

/** RN-CUI-18: what the caregiver sets up by themselves. */
const CAREGIVER_LINKS: { label: string; icon: IconName; href: Href }[] = [
  { label: 'Tu perfil y tu horario', icon: 'user', href: '/cuidador/perfil' },
  { label: 'Tus precios', icon: 'circle-dollar-sign', href: '/cuidador/precios' },
  { label: 'Tus documentos', icon: 'id-card', href: '/cuidador/documentos' },
  { label: 'Curso de bienvenida', icon: 'book-open', href: '/cuidador/curso' },
];

// No mockup: who is signed in, the switch between owner and caregiver mode (RN-CTA-06) and, in
// caregiver mode, the caregiver's own screens.
export default function AccountScreen() {
  const me = useUsersMe();
  const mode = useMode();
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<unknown>(null);
  const isCaregiver = me.data?.roles.includes('CAREGIVER') ?? false;

  const changeMode = async (next: AppMode) => {
    setSwitching(true);
    setSwitchError(null);
    try {
      await switchMode(next);
    } catch (error) {
      setSwitchError(error);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title" accessibilityRole="header">
          Cuenta
        </Text>
        {me.data && (
          <Card style={styles.profile}>
            <Avatar name={`${me.data.firstName} ${me.data.lastName}`} size={56} />
            <View style={styles.flex}>
              <Text variant="heading">
                {me.data.firstName} {me.data.lastName}
              </Text>
              <Text variant="caption" color="inkMuted">
                {me.data.email}
              </Text>
            </View>
          </Card>
        )}

        {mode === 'CAREGIVER' && (
          <View>
            {CAREGIVER_LINKS.map(({ label, icon, href }, index) => (
              <Row key={label} divider={index > 0} onPress={() => router.push(href)}>
                <Icon name={icon} />
                <Text variant="subheading" style={styles.flex}>
                  {label}
                </Text>
                <Icon name="chevron-right" color="inkMuted" />
              </Row>
            ))}
          </View>
        )}

        {mode === 'OWNER' && !isCaregiver && me.data && (
          <Row onPress={() => router.push('/cuidador/activar')} style={styles.becomeCaregiver}>
            <View style={styles.paw}>
              <Icon name="paw-print" />
            </View>
            <View style={styles.flex}>
              <Text variant="subheading">Cuida mascotas con Pawie</Text>
              <Text variant="caption" color="inkMuted">
                Activa el modo cuidador. Tu cuenta de dueño sigue igual.
              </Text>
            </View>
            <Icon name="chevron-right" color="inkMuted" />
          </Row>
        )}

        {switchError !== null && <Banner tone="error" message={errorMessage(switchError)} />}
        {(mode === 'CAREGIVER' || isCaregiver) && (
          <Button
            variant="secondary"
            icon={<Icon name="repeat" />}
            label={mode === 'CAREGIVER' ? 'Cambiar a modo dueño' : 'Cambiar a modo cuidador'}
            loading={switching}
            onPress={() => changeMode(mode === 'CAREGIVER' ? 'OWNER' : 'CAREGIVER')}
          />
        )}
        <Button variant="ghost" label="Cerrar sesión" onPress={signOut} />
        {__DEV__ && (
          <Button
            variant="ghost"
            label="Catálogo de componentes"
            onPress={() => router.push('/catalogo')}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { gap: space[4], padding: space[4], paddingTop: space[6] },
  flex: { flex: 1 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  becomeCaregiver: { paddingVertical: space[3] },
  paw: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.tint,
  },
});
