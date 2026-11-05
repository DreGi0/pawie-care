import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { colors } from '@/theme/tokens';

/** Width of the app on a wide screen: a phone's column, centered on a neutral background. */
const COLUMN_WIDTH = 430;

/** The web build of the app, in a 430 px column when the window is wider than that. */
export function Frame({ children }: { children: ReactNode }) {
  return (
    <View style={styles.page}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}

/**
 * The same column for what the browser draws outside the app's tree, such as the modals of
 * Sheet and ConfirmDialog, which would otherwise span the whole window.
 */
export const columnStyle: ViewStyle = {
  width: '100%',
  maxWidth: COLUMN_WIDTH,
  alignSelf: 'center',
};

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', backgroundColor: colors.line },
  column: { flex: 1, width: '100%', maxWidth: COLUMN_WIDTH, overflow: 'hidden' },
});
