import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, space } from '@/theme/tokens';

import { Text } from './Text';

export type FormScreenProps = {
  title: string;
  subtitle?: string;
  /** Above the title, such as the back button or the StepBar. */
  top?: ReactNode;
  children: ReactNode;
};

/** The frame of a form screen: it scrolls and keeps the focused field above the keyboard. */
export function FormScreen({ title, subtitle, top, children }: FormScreenProps) {
  return (
    <SafeAreaView style={styles.screen}>
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { flexGrow: 1, gap: space[6], padding: space[4], paddingBottom: space[8] },
  header: { gap: space[1] },
});
