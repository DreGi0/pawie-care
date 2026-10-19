import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError, useAuthLogin, type LoginRequest } from '@pawie/api-client';
import { AuthLoginBody } from '@pawie/api-client/zod';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Text } from '@/components/Text';
import { signIn } from '@/lib/session';
import { colors, space } from '@/theme/tokens';

// The API's limits, plus a password that isn't empty.
const LoginForm = AuthLoginBody.extend({ password: AuthLoginBody.shape.password.min(1) });

// The mockup's "¿Olvidaste tu contraseña?" and "Crea tu cuenta" links wait for their
// screens: the API has no password reset yet, and sign-up comes in the next phase.
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

  const submit = () => handleSubmit((data) => login.mutate({ data }, { onSuccess: signIn }))();

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function loginErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'No pudimos conectarnos con Pawie. Revisa tu conexión e intenta de nuevo.';
  }
  if (error.errorCode === 'INVALID_CREDENTIALS') {
    return 'El correo o la contraseña no coinciden. Revísalos e intenta de nuevo.';
  }
  return error.body?.message ?? 'Algo salió mal. Intenta de nuevo en un momento.';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: {
    flexGrow: 1,
    gap: space[6],
    paddingHorizontal: space[4],
    paddingTop: space[8],
    paddingBottom: space[8],
  },
  header: { gap: space[1] },
  form: { gap: space[4] },
  footer: { marginTop: 'auto' },
});
