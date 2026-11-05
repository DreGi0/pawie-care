import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, gutter, space } from '@/theme/tokens';

import { Banner } from './Banner';
import { Button } from './Button';
import { Text } from './Text';

export type ServerWakingProps = {
  state: 'waking' | 'unreachable';
  onRetry: () => void;
};

/**
 * The public demo's API sleeps on Render's free plan and takes about a minute to wake up
 * (docs/plan-v0.6.md, etapa Demo pública). "Reintentar" is the screen's only action.
 */
export function ServerWaking({ state, onRetry }: ServerWakingProps) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        {state === 'waking' ? (
          <>
            <ActivityIndicator color={colors.primary} />
            <Text variant="heading" style={styles.center}>
              Despertando el servidor…
            </Text>
            <Text color="inkMuted" style={styles.center}>
              La demo se duerme cuando nadie la usa. Puede tardar hasta un minuto.
            </Text>
          </>
        ) : (
          <>
            <Banner
              tone="error"
              message="No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo."
            />
            <Button label="Reintentar" onPress={onRetry} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, justifyContent: 'center', gap: space[4], paddingHorizontal: gutter },
  center: { textAlign: 'center' },
});
