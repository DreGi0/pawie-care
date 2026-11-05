import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

/** On the phone the app is the whole screen. The web version, in Frame.web.tsx, draws a column. */
export function Frame({ children }: { children: ReactNode }) {
  return children;
}

/** For what is drawn outside the app's tree, such as modals: nothing to constrain on the phone. */
export const columnStyle: ViewStyle = {};
