import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { css, cubicBezier } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, gutter, radius, space } from '@/theme/tokens';

import { columnStyle } from './Frame';
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
          style={[
            styles.sheet,
            columnStyle,
            { paddingBottom: Math.max(insets.bottom, space[4]) },
            animations.slideUp,
          ]}
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

// A CSS animation of the transform, not a layout animation: inside a Modal on Android, the
// layout animation (SlideInDown) ended ~80 dp above the bottom edge when the sheet was short.
const slideUp = css.keyframes({
  from: { transform: [{ translateY: '100%' }] },
  to: { transform: [{ translateY: 0 }] },
});

const animations = css.create({
  slideUp: {
    animationName: slideUp,
    animationDuration: 320,
    animationTimingFunction: cubicBezier(0.2, 0.9, 0.3, 1),
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(37, 32, 74, 0.4)' },
  sheet: {
    maxHeight: '88%',
    paddingTop: space[2],
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
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
    paddingLeft: gutter,
    paddingRight: space[2],
    paddingTop: space[2],
  },
  title: { flex: 1 },
  content: { gap: space[6], paddingHorizontal: gutter, paddingVertical: space[4] },
  footer: { gap: space[2], paddingHorizontal: gutter, paddingTop: space[2] },
});
