import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { Nimbus } from '@/components/Nimbus';
import { Text } from '@/components/Text';
import { colors, radius, space, type ColorName } from '@/theme/tokens';

const reasons: { icon: IconName | '⭐'; background: ColorName; text: string }[] = [
  {
    icon: '⭐',
    background: 'butter',
    text: 'Cuidadores ⭐ con curso de cuidado especial, para mascotas mayores o en recuperación.',
  },
  { icon: 'check', background: 'sage', text: 'Pagas solo cuando el cuidador acepta tu visita.' },
  {
    icon: 'lock',
    background: 'sky',
    text: 'Tu dirección solo la ve quien confirma una visita contigo.',
  },
];

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="heading" style={styles.centered}>
          Pawie Care
        </Text>

        <Animated.View entering={FadeInDown.duration(500)} style={styles.hero}>
          <Nimbus pose="hola" background="grape" size={144} />
          <View style={styles.heroText}>
            <Text variant="display" style={styles.centered} accessibilityRole="header">
              Cuidadores de confianza para tu mascota
            </Text>
            <Text style={styles.centered}>
              Visitas y pernoctas en tu casa, en San Salvador y alrededores.
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(500)}>
          <Card style={styles.reasons}>
            {reasons.map((reason) => (
              <View key={reason.text} style={styles.reason}>
                <View style={[styles.reasonIcon, { backgroundColor: colors[reason.background] }]}>
                  {reason.icon === '⭐' ? (
                    <Text variant="label">⭐</Text>
                  ) : (
                    <Icon name={reason.icon} size={18} />
                  )}
                </View>
                <Text style={styles.reasonText}>{reason.text}</Text>
              </View>
            ))}
          </Card>
        </Animated.View>

        <View style={styles.actions}>
          <Button label="Crear mi cuenta" onPress={() => router.push('/registro')} />
          <Button
            variant="secondary"
            label="Ya tengo cuenta"
            onPress={() => router.push('/login')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { flexGrow: 1, gap: space[6], padding: space[4], paddingTop: space[6] },
  centered: { textAlign: 'center' },
  hero: { alignItems: 'center', gap: space[6] },
  heroText: { gap: space[2] },
  reasons: { gap: space[3] },
  reason: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  reasonIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  reasonText: { flex: 1 },
  actions: { marginTop: 'auto', gap: space[3] },
});
