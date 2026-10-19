import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, space } from '@/theme/tokens';

import { IconButton } from './IconButton';
import { Text } from './Text';

/** Placeholder for a screen that isn't built yet. */
export function ComingSoon({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.content}>
        {onBack && <IconButton icon="chevron-left" accessibilityLabel="Volver" onPress={onBack} />}
        <Text variant="title">{title}</Text>
        <Text color="inkMuted">Esta pantalla llega en la siguiente fase.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { gap: space[4], padding: space[4], paddingTop: space[6] },
});
