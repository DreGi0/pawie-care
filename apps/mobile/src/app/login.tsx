import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError, useAuthLogin, type LoginRequest } from '@pawie/api-client';
import { AuthLoginBody } from '@pawie/api-client/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Input } from '@/components/Input';
import { Text } from '@/components/Text';
import { errorMessage } from '@/lib/api';
import { signIn } from '@/lib/session';
import { colors, space } from '@/theme/tokens';

// The API's limits, plus a password that isn't empty.
const LoginForm = AuthLoginBody.extend({ password: AuthLoginBody.shape.password.min(1) });

// The mockup's "¿Olvidaste tu contraseña?" waits for the API, which has no password reset yet.
export default function LoginScreen() {
  const login = useAuthLogin();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>({
    resolver: zodResolver(LoginForm),
    defaultValues: { email: '', password: '' },
  });

  const submit = () =>
    handleSubmit((data) => login.mutate({ data }, { onSuccess: (session) => signIn(session) }))();

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <IconButton icon="chevron-left" accessibilityLabel="Volver" onPress={goBack} />

          <View style={styles.header}>
            <Text variant="title">Qué bueno verte de nuevo</Text>
            <Text color="inkMuted">Entra con tu correo y contraseña.</Text>
          </View>

          {login.isError && <Banner tone="error" message={loginErrorMessage(login.error)} />}

          <View style={styles.form}>
            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <Input
                  label="Correo"
                  placeholder="tu@correo.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.email?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <Input
                  label="Contraseña"
                  placeholder="Tu contraseña"
                  secureTextEntry
                  autoComplete="current-password"
                  textContentType="password"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  onSubmitEditing={submit}
                  error={errors.password?.message}
                />
              )}
            />
          </View>

          <View style={styles.footer}>
            <Button label="Iniciar sesión" loading={login.isPending} onPress={submit} />
            <View style={styles.switch}>
              <Text>¿Eres nuevo en Pawie?</Text>
              <Button
                variant="ghost"
                label="Crea tu cuenta"
                onPress={() => router.replace('/registro')}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/bienvenida');
}

function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.errorCode === 'INVALID_CREDENTIALS') {
    return 'El correo o la contraseña no coinciden. Revísalos e intenta de nuevo.';
  }
  return errorMessage(error);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: {
    flexGrow: 1,
    gap: space[6],
    paddingHorizontal: space[4],
    paddingTop: space[4],
    paddingBottom: space[8],
  },
  header: { gap: space[1] },
  form: { gap: space[4] },
  footer: { marginTop: 'auto', gap: space[2] },
  switch: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
