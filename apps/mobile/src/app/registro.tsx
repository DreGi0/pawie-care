import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError, useAuthRegister } from '@pawie/api-client';
import { AuthRegisterBody } from '@pawie/api-client/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { IconButton } from '@/components/IconButton';
import { Input } from '@/components/Input';
import { Text } from '@/components/Text';
import { errorMessage } from '@/lib/api';
import { maskDate, maskPhone, parseDate, parsePhone } from '@/lib/format';
import { signIn } from '@/lib/session';
import { space } from '@/theme/tokens';

// The API's limits, with dates and phones as people type them.
const RegisterForm = z.object({
  firstName: AuthRegisterBody.shape.firstName.trim().min(1),
  lastName: AuthRegisterBody.shape.lastName.trim().min(1),
  email: AuthRegisterBody.shape.email,
  password: AuthRegisterBody.shape.password,
  birthDate: z.string().refine((text) => parseDate(text) !== null, {
    message: 'Escribe la fecha como DD/MM/AAAA.',
  }),
  phone: z.string().refine((text) => text === '' || parsePhone(text) !== null, {
    message: 'Escribe un teléfono de 8 dígitos, como 7000 0000.',
  }),
});

type RegisterValues = z.infer<typeof RegisterForm>;

// "Términos" and "Aviso de privacidad" are plain text until those pages exist.
export default function RegisterScreen() {
  const register = useAuthRegister();
  const [showPassword, setShowPassword] = useState(false);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(RegisterForm),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      birthDate: '',
      phone: '',
    },
  });

  const submit = handleSubmit(({ birthDate, phone, ...form }) =>
    register.mutate(
      {
        data: {
          ...form,
          birthDate: parseDate(birthDate)!,
          phone: phone ? parsePhone(phone)! : undefined,
        },
      },
      {
        onSuccess: (session) => signIn(session, { newAccount: true }),
        onError: (error) => {
          // These two belong to a field: the banner is for the rest.
          if (error instanceof ApiError && error.errorCode === 'EMAIL_TAKEN') {
            setError('email', { message: 'Ya hay una cuenta con este correo. Inicia sesión.' });
          } else if (error instanceof ApiError && error.errorCode === 'UNDERAGE') {
            setError('birthDate', { message: errorMessage(error) });
          }
        },
      },
    ),
  );

  const bannerError =
    register.isError &&
    !(register.error.errorCode === 'EMAIL_TAKEN' || register.error.errorCode === 'UNDERAGE');

  return (
    <FormScreen
      title="Crea tu cuenta"
      subtitle="Te toma un minuto. Después registramos a tu mascota."
      top={<IconButton icon="chevron-left" accessibilityLabel="Volver" onPress={goBack} />}
    >
      {bannerError && <Banner tone="error" message={errorMessage(register.error)} />}

      <View style={styles.form}>
        <View style={styles.row}>
          <View style={styles.half}>
            <Controller
              control={control}
              name="firstName"
              render={({ field }) => (
                <Input
                  label="Nombre"
                  placeholder="Tu nombre"
                  autoComplete="given-name"
                  textContentType="givenName"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.firstName?.message}
                />
              )}
            />
          </View>
          <View style={styles.half}>
            <Controller
              control={control}
              name="lastName"
              render={({ field }) => (
                <Input
                  label="Apellido"
                  placeholder="Tu apellido"
                  autoComplete="family-name"
                  textContentType="familyName"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.lastName?.message}
                />
              )}
            />
          </View>
        </View>
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
              placeholder="Crea una contraseña"
              helper="Mínimo 8 caracteres."
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              textContentType="newPassword"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.password?.message}
              accessory={
                <IconButton
                  variant="plain"
                  icon={showPassword ? 'eye-off' : 'eye'}
                  accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
            />
          )}
        />
        <Controller
          control={control}
          name="birthDate"
          render={({ field }) => (
            <Input
              label="Fecha de nacimiento"
              placeholder="DD/MM/AAAA"
              helper="Para usar Pawie necesitas tener 18 años o más."
              keyboardType="number-pad"
              autoComplete="birthdate-full"
              value={field.value}
              onChangeText={(text) => field.onChange(maskDate(text))}
              onBlur={field.onBlur}
              error={errors.birthDate?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <Input
              label="Teléfono"
              optional
              prefix="+503"
              placeholder="7000 0000"
              keyboardType="phone-pad"
              autoComplete="tel-national"
              textContentType="telephoneNumber"
              value={field.value}
              onChangeText={(text) => field.onChange(maskPhone(text))}
              onBlur={field.onBlur}
              error={errors.phone?.message}
            />
          )}
        />
      </View>

      <View style={styles.footer}>
        <Text variant="caption" color="inkMuted" style={styles.centered}>
          Al crear tu cuenta aceptas los Términos y el Aviso de privacidad.
        </Text>
        <Button label="Crear cuenta" loading={register.isPending} onPress={() => submit()} />
        <View style={styles.switch}>
          <Text>¿Ya tienes cuenta?</Text>
          <Button variant="ghost" label="Inicia sesión" onPress={() => router.replace('/login')} />
        </View>
      </View>
    </FormScreen>
  );
}

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/bienvenida');
}

const styles = StyleSheet.create({
  form: { gap: space[4] },
  row: { flexDirection: 'row', gap: space[3] },
  half: { flex: 1 },
  footer: { marginTop: 'auto', gap: space[4] },
  centered: { textAlign: 'center' },
  switch: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
