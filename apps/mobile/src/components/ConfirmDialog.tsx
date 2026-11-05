import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors, gutter, radius, space } from '@/theme/tokens';

import { Button } from './Button';
import { columnStyle } from './Frame';
import { Text } from './Text';

type ConfirmOptions = {
  title: string;
  message?: string;
  /** Label of the button that goes ahead. */
  confirmLabel: string;
  /** Label of the button that backs out. */
  cancelLabel: string;
  /** The action can't be undone, so its button is drawn as `danger`. */
  destructive?: boolean;
};

type Dialogs = {
  /** Asks first. Resolves true if the person went ahead, false if they backed out. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Tells something and waits for "Entendido". */
  notice: (title: string, message?: string) => Promise<void>;
};

type Request = {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  resolve: (confirmed: boolean) => void;
};

const DialogsContext = createContext<Dialogs | null>(null);

/**
 * Replaces Alert.alert on the three platforms: with buttons it does nothing in
 * react-native-web. One dialog at a time; a second one waits for the first.
 */
export function DialogsProvider({ children }: { children: ReactNode }) {
  // The first one is on screen; the rest wait their turn.
  const [queue, setQueue] = useState<Request[]>([]);
  const current = queue[0] ?? null;

  const open = useCallback(
    (request: Omit<Request, 'resolve'>) =>
      new Promise<boolean>((resolve) => {
        setQueue((waiting) => [...waiting, { ...request, resolve }]);
      }),
    [],
  );

  const answer = (confirmed: boolean) => {
    current?.resolve(confirmed);
    setQueue((waiting) => waiting.slice(1));
  };

  const dialogs = useMemo<Dialogs>(
    () => ({
      confirm: (options) => open(options),
      notice: async (title, message) => {
        await open({ title, message, confirmLabel: 'Entendido' });
      },
    }),
    [open],
  );

  return (
    <DialogsContext.Provider value={dialogs}>
      {children}
      <Modal
        visible={current !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => answer(false)}
      >
        <View style={styles.root}>
          <Pressable
            style={styles.backdrop}
            accessibilityLabel="Cerrar"
            accessibilityRole="button"
            onPress={() => answer(false)}
          />
          <View style={[styles.column, columnStyle]}>
            {current && (
              <View style={styles.card} accessibilityViewIsModal>
                <Text variant="heading" accessibilityRole="header">
                  {current.title}
                </Text>
                {current.message ? <Text>{current.message}</Text> : null}
                <View style={styles.buttons}>
                  <Button
                    variant={
                      current.destructive ? 'danger' : current.cancelLabel ? 'primary' : 'secondary'
                    }
                    label={current.confirmLabel}
                    onPress={() => answer(true)}
                  />
                  {current.cancelLabel ? (
                    <Button
                      variant="secondary"
                      label={current.cancelLabel}
                      onPress={() => answer(false)}
                    />
                  ) : null}
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </DialogsContext.Provider>
  );
}

/** `confirm` and `notice`, to use in place of Alert.alert. */
export function useDialogs(): Dialogs {
  const dialogs = useContext(DialogsContext);
  if (!dialogs) throw new Error('useDialogs needs a DialogsProvider above it');
  return dialogs;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(37, 32, 74, 0.4)' },
  // box-none: a tap beside the card reaches the backdrop and closes the dialog.
  column: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: gutter,
    pointerEvents: 'box-none',
  },
  card: {
    gap: space[4],
    padding: space[5],
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
  },
  buttons: { gap: space[2] },
});
