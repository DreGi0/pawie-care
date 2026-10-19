import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { queryClient } from '@/lib/api';
import { restoreSession, useOnboarding, useSessionStatus } from '@/lib/session';
import { configureZod } from '@/lib/zod';
import { nunitoFonts } from '@/theme/fonts';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();
configureZod();
restoreSession();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(nunitoFonts);
  const session = useSessionStatus();
  const onboarding = useOnboarding();
  const ready = (fontsLoaded || fontError !== null) && session !== 'loading';

  useEffect(() => {
    if (fontError)
      console.warn('Nunito failed to load, falling back to the system font', fontError);
  }, [fontError]);

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.cream },
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
          <Stack.Screen name="direcciones/nueva" />
          <Stack.Screen name="cuidadores/[id]" />
          <Stack.Screen name="reservar" />
          <Stack.Screen name="reservas/[id]" />
          <Stack.Screen name="payment/result" />
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
    </QueryClientProvider>
  );
}
