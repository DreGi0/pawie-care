import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { DialogsProvider } from '@/components/ConfirmDialog';
import { Frame } from '@/components/Frame';
import { ServerWaking } from '@/components/ServerWaking';
import { queryClient } from '@/lib/api';
import {
  restoreSession,
  retryStartup,
  useOnboarding,
  useSessionStatus,
  useWake,
} from '@/lib/session';
import { configureZod } from '@/lib/zod';
import { fonts } from '@/theme/fonts';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();
configureZod();
restoreSession();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fonts);
  const session = useSessionStatus();
  const onboarding = useOnboarding();
  const wake = useWake();
  const fontsReady = fontsLoaded || fontError !== null;
  const ready = fontsReady && session !== 'loading';
  const waiting = fontsReady && wake !== 'none';

  useEffect(() => {
    if (fontError)
      console.warn('The fonts failed to load, falling back to the system font', fontError);
  }, [fontError]);

  useEffect(() => {
    if (ready || waiting) SplashScreen.hide();
  }, [ready, waiting]);

  if (waiting) {
    return (
      <Frame>
        <ServerWaking state={wake} onRetry={retryStartup} />
      </Frame>
    );
  }
  if (!ready) return null;

  return (
    <Frame>
      <QueryClientProvider client={queryClient}>
        <DialogsProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'slide_from_right',
            }}
          >
            {/* When a guard closes the current screen, the stack goes to its group's redirectTo:
            signing out goes to Bienvenida, and signing up to the onboarding. */}
            <Stack.Protected guard={session === 'signedIn' && onboarding} redirectTo="/">
              <Stack.Screen name="onboarding/mascota" />
              <Stack.Screen name="onboarding/direccion" />
            </Stack.Protected>
            <Stack.Protected guard={session === 'signedIn'} redirectTo="/bienvenida">
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="mascotas/nueva" />
              <Stack.Screen name="mascotas/[id]/index" />
              <Stack.Screen name="mascotas/[id]/datos" />
              <Stack.Screen name="mascotas/[id]/rutina" />
              <Stack.Screen name="mascotas/[id]/horario" />
              <Stack.Screen name="mascotas/[id]/salud" />
              <Stack.Screen name="mascotas/[id]/vacuna" />
              <Stack.Screen name="mascotas/[id]/tarea" />
              <Stack.Screen name="mascotas/[id]/celo" />
              <Stack.Screen name="direcciones/nueva" />
              <Stack.Screen name="cuidadores/[id]" />
              <Stack.Screen name="reservar" />
              <Stack.Screen name="reservas/[id]" />
              <Stack.Screen name="payment/result" />
              <Stack.Screen name="cuidador/activar" />
              <Stack.Screen name="cuidador/documentos" />
              <Stack.Screen name="cuidador/curso" />
              <Stack.Screen name="cuidador/perfil" />
              <Stack.Screen name="cuidador/precios" />
              <Stack.Screen name="cuidador/reservas/[id]" />
            </Stack.Protected>
            <Stack.Protected
              guard={session === 'signedOut'}
              redirectTo={onboarding ? '/onboarding/mascota' : '/'}
            >
              <Stack.Screen name="bienvenida" />
              <Stack.Screen name="login" />
              <Stack.Screen name="registro" />
            </Stack.Protected>
            <Stack.Protected guard={__DEV__}>
              <Stack.Screen name="catalogo" />
            </Stack.Protected>
          </Stack>
        </DialogsProvider>
      </QueryClientProvider>
    </Frame>
  );
}
