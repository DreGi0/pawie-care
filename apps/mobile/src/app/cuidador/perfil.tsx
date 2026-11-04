import { zodResolver } from '@hookform/resolvers/zod';
import {
  getCaregiverMeGetQueryKey,
  useCaregiverMeGet,
  useCaregiverMeUpdate,
  useCatalogGet,
  useUsersMe,
  type CaregiverMeResponse,
  type CatalogResponse,
} from '@pawie/api-client';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { CaregiverPhoto } from '@/components/CaregiverPhoto';
import { Checkbox } from '@/components/Checkbox';
import { Chip } from '@/components/Chip';
import { IconButton } from '@/components/IconButton';
import { Input } from '@/components/Input';
import { Text } from '@/components/Text';
import { errorMessage, queryClient } from '@/lib/api';
import {
  FRANJA_NAMES,
  franjasOf,
  franjaWindows,
  SKILL_NAMES,
  WEEKDAYS,
  windowsOf,
  type Franja,
} from '@/lib/caregivers';
import { uploadFile } from '@/lib/files';
import { colors, gutter, space } from '@/theme/tokens';

const SKILLS = Object.keys(SKILL_NAMES) as (keyof typeof SKILL_NAMES)[];

const ProfileFields = z.object({
  bio: z.string().trim().max(1000, 'La descripción puede tener hasta 1000 caracteres.'),
  skills: z.array(z.enum(SKILLS)),
  districtIds: z.array(z.string()),
  /** Keys like "1:MORNING", see franjasOf. */
  franjas: z.array(z.string()),
  instantBooking: z.boolean(),
  isPaused: z.boolean(),
});

type ProfileValues = z.infer<typeof ProfileFields>;

/** "19:00" from 1140 minutes, past midnight too: 1920 is "8:00". */
function clock(minute: number): string {
  const inDay = minute % (24 * 60);
  return `${Math.floor(inDay / 60)}:${String(inDay % 60).padStart(2, '0')}`;
}

// CuiPerfil (RN-CUI-18, RN-CUI-20): what owners see and when the caregiver can work. The weekly
// schedule is edited by franjas (RN-CUI-04).
export default function CaregiverProfileScreen() {
  const profile = useCaregiverMeGet();
  const catalog = useCatalogGet();

  return (
    <SafeAreaView style={styles.screen}>
      {profile.data && catalog.data ? (
        <ProfileForm profile={profile.data} catalog={catalog.data} />
      ) : (
        <View style={styles.content}>
          <IconButton
            icon="chevron-left"
            accessibilityLabel="Volver"
            onPress={() => router.back()}
          />
          {profile.isError || catalog.isError ? (
            <Banner tone="error" message={errorMessage(profile.error ?? catalog.error)} />
          ) : (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

function ProfileForm({
  profile,
  catalog,
}: {
  profile: CaregiverMeResponse;
  catalog: CatalogResponse;
}) {
  const me = useUsersMe();
  const update = useCaregiverMeUpdate();
  const [photo, setPhoto] = useState<{ uri: string; fileId: string | null } | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const { overnightStartMinute, overnightEndMinute } = catalog.bookingRules;
  const franjas = franjaWindows({
    startMinute: overnightStartMinute,
    endMinute: overnightEndMinute,
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileValues>({
    resolver: zodResolver(ProfileFields),
    defaultValues: {
      bio: profile.bio ?? '',
      skills: profile.skills,
      districtIds: profile.districts.map(({ id }) => id),
      franjas: [...franjasOf(profile.availability, franjas)],
      instantBooking: profile.instantBooking,
      isPaused: profile.isPaused,
    },
  });

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;

    setPhoto({ uri: asset.uri, fileId: null });
    setPhotoError(false);
    try {
      const fileId = await uploadFile(asset.uri, asset.mimeType ?? 'image/jpeg', 'CAREGIVER_PHOTO');
      setPhoto({ uri: asset.uri, fileId });
    } catch {
      setPhoto(null);
      setPhotoError(true);
    }
  };
  const uploading = photo !== null && photo.fileId === null;

  const submit = handleSubmit(({ franjas: selected, ...values }) =>
    update.mutate(
      {
        data: {
          ...values,
          ...(photo?.fileId && { photoFileId: photo.fileId }),
          availability: windowsOf(new Set(selected), franjas),
        },
      },
      {
        onSuccess: (saved) => {
          queryClient.setQueryData(getCaregiverMeGetQueryKey(), saved);
          router.back();
        },
      },
    ),
  );

  const name = me.data ? `${me.data.firstName} ${me.data.lastName}` : '';
  const toggle = <T,>(list: readonly T[], item: T) =>
    list.includes(item) ? list.filter((other) => other !== item) : [...list, item];

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <IconButton icon="chevron-left" accessibilityLabel="Volver" onPress={() => router.back()} />
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          Tu perfil
        </Text>
        <Text color="inkMuted">Lo que ven los dueños y cuándo puedes cuidar.</Text>
      </View>

      <View style={styles.photoRow}>
        <CaregiverPhoto name={name} photoUrl={photo?.uri ?? profile.photoUrl} width={112} />
        <View style={styles.flex}>
          <Button
            variant="secondary"
            label={photo || profile.photoUrl ? 'Cambiar foto' : 'Agregar foto'}
            loading={uploading}
            onPress={pickPhoto}
          />
        </View>
      </View>
      {photoError && <Banner tone="error" message="No pudimos subir la foto. Intenta con otra." />}

      <Controller
        control={control}
        name="bio"
        render={({ field }) => (
          <Input
            label="Sobre ti"
            optional
            multiline
            placeholder="Ej.: Estudio veterinaria y tengo dos perros."
            helper="Tu experiencia con perros y gatos, y cómo los cuidas."
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.bio?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="skills"
        render={({ field }) => (
          <Field
            label="Tienes experiencia con"
            helper="Los dueños ven que lo dices tú: no es una certificación."
          >
            {SKILLS.map((skill) => (
              <Chip
                key={skill}
                label={SKILL_NAMES[skill]}
                selected={field.value.includes(skill)}
                onPress={() => field.onChange(toggle(field.value, skill))}
              />
            ))}
          </Field>
        )}
      />

      <Controller
        control={control}
        name="districtIds"
        render={({ field }) => (
          <Field label="Distritos donde cuidas">
            {catalog.districts.map((district) => (
              <Chip
                key={district.id}
                label={district.name}
                selected={field.value.includes(district.id)}
                onPress={() => field.onChange(toggle(field.value, district.id))}
              />
            ))}
          </Field>
        )}
      />

      <Controller
        control={control}
        name="franjas"
        render={({ field }) => (
          <View style={styles.field}>
            <Text variant="label">Tu horario</Text>
            <Text variant="caption" color="inkMuted">
              Mañana de {clock(franjas.MORNING.startMinute)} a {clock(franjas.MORNING.endMinute)},
              tarde de {clock(franjas.AFTERNOON.startMinute)} a {clock(franjas.AFTERNOON.endMinute)}{' '}
              y noche de {clock(franjas.NIGHT.startMinute)} a {clock(franjas.NIGHT.endMinute)}, la
              de las pernoctas.
            </Text>
            <View style={styles.week}>
              {WEEKDAYS.map(({ weekday, short, long }) => (
                <View key={weekday} style={styles.day}>
                  <Text variant="bodyStrong" style={styles.dayName} accessibilityLabel={long}>
                    {short}
                  </Text>
                  <View style={styles.franjas}>
                    {(Object.keys(FRANJA_NAMES) as Franja[]).map((franja) => {
                      const key = `${weekday}:${franja}`;
                      return (
                        <View key={franja} style={styles.flex}>
                          <Chip
                            label={FRANJA_NAMES[franja]}
                            accessibilityLabel={`${long}, ${FRANJA_NAMES[franja]}`}
                            selected={field.value.includes(key)}
                            onPress={() => field.onChange(toggle(field.value, key))}
                          />
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      />

      <View>
        <Controller
          control={control}
          name="instantBooking"
          render={({ field }) => (
            <Checkbox
              label="Reserva inmediata: acepto las solicitudes sin revisarlas"
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="isPaused"
          render={({ field }) => (
            <Checkbox
              label="Pausar mi perfil: no aparezco en las búsquedas, pero conservo mis reservas"
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </View>

      {update.isError && <Banner tone="error" message={errorMessage(update.error)} />}
      <Button
        label="Guardar"
        loading={update.isPending}
        disabled={uploading}
        onPress={() => submit()}
      />
    </ScrollView>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      {helper && (
        <Text variant="caption" color="inkMuted">
          {helper}
        </Text>
      )}
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    gap: space[6],
    paddingHorizontal: gutter,
    paddingTop: space[1],
    paddingBottom: space[8],
  },
  loading: { marginTop: space[8] },
  header: { gap: space[1] },
  flex: { flex: 1 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  field: { gap: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  week: { gap: space[2], marginTop: space[1] },
  day: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  dayName: { width: 40 },
  franjas: { flex: 1, flexDirection: 'row', gap: space[2] },
});
