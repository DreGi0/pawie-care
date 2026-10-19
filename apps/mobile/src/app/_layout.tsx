import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { queryClient } from '@/lib/api';
import { restoreSession, useSessionStatus } from '@/lib/session';
import { configureZod } from '@/lib/zod';
import { nunitoFonts } from '@/theme/fonts';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();
configureZod();
restoreSession();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(nunitoFonts);
  const session = useSessionStatus();
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
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }}
      >
        <Stack.Protected guard={session === 'signedIn'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="mascotas/nueva" />
        </Stack.Protected>
        <Stack.Protected guard={session === 'signedOut'}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        <Stack.Protected guard={__DEV__}>
          <Stack.Screen name="catalogo" />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
