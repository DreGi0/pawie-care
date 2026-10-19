import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space } from '@/theme/tokens';

import { IconButton } from './IconButton';
import { Text } from './Text';

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Stays under the scrolling content, such as the sheet's button. */
  footer?: ReactNode;
};

/** A panel that slides up from the bottom, over the screen. Tapping outside closes it. */
export function Sheet({ visible, onClose, title, children, footer }: SheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          accessibilityLabel="Cerrar"
          accessibilityRole="button"
          onPress={onClose}
        />
        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(180)}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space[4]) }]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text variant="heading" style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <IconButton icon="x" variant="plain" accessibilityLabel="Cerrar" onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer && <View style={styles.footer}>{footer}</View>}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(59, 51, 70, 0.4)' },
  sheet: {
    maxHeight: '88%',
    paddingTop: space[2],
    backgroundColor: colors.cream,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingLeft: space[4],
    paddingRight: space[2],
    paddingTop: space[2],
  },
  title: { flex: 1 },
  content: { gap: space[4], padding: space[4] },
  footer: { paddingHorizontal: space[4], paddingTop: space[2] },
});
