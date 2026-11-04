import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, gutter, space } from '@/theme/tokens';

import { Text } from './Text';

export type FormScreenProps = {
  title: string;
  subtitle?: string;
  /** Above the title, such as the back button or the StepBar. */
  top?: ReactNode;
  children: ReactNode;
  /**
   * Fixed under the scrolling content, such as a BottomBar with the screen's action, so it
   * shows without scrolling on any phone.
   */
  footer?: ReactNode;
};

/**
 * The frame of a form screen: it scrolls, keeps the focused field above the keyboard and keeps
 * the last element clear of the home indicator. With a footer, the footer keeps clear of it.
 */
export function FormScreen({ title, subtitle, top, children, footer }: FormScreenProps) {
  return (
    <SafeAreaView style={styles.screen} edges={footer ? ['top', 'left', 'right'] : undefined}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {top}
          <View style={styles.header}>
            <Text variant="title" accessibilityRole="header">
              {title}
            </Text>
            {subtitle && <Text color="inkMuted">{subtitle}</Text>}
          </View>
          {children}
        </ScrollView>
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, gap: space[6], padding: gutter, paddingBottom: space[8] },
  header: { gap: space[1] },
});
