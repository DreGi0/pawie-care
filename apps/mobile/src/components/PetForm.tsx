import { zodResolver } from '@hookform/resolvers/zod';
import {
  getPetsListQueryKey,
  useCatalogGet,
  usePetsCreate,
  usePetsReplace,
  type PetResponse,
} from '@pawie/api-client';
import { PetsCreateBody } from '@pawie/api-client/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { errorMessage } from '@/lib/api';
import { uploadFile } from '@/lib/files';
import { localDate, maskDate, parseDate } from '@/lib/format';
import { colors, space } from '@/theme/tokens';

import { Banner } from './Banner';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Chip } from './Chip';
import { Icon } from './Icon';
import { Input } from './Input';
import { Text } from './Text';
import { Touchable } from './Touchable';

const PetFields = z.object({
  name: PetsCreateBody.shape.name.trim().min(1),
  speciesId: z.string().min(1, 'Elige si es perro o gato.'),
  sex: z.enum(['FEMALE', 'MALE'], { message: 'Elige si es hembra o macho.' }),
  birthDate: z
    .string()
    .refine((text) => parseDate(text) !== null, { message: 'Escribe la fecha como DD/MM/AAAA.' })
    .refine((text) => (parseDate(text) ?? '') <= localDate(new Date()), {
      message: 'La fecha no puede ser después de hoy.',
    }),
  birthDateIsApproximate: z.boolean(),
  breed: z.string().trim().max(80),
});

type PetValues = z.infer<typeof PetFields>;

const sexes = [
  { value: 'FEMALE', label: 'Hembra' },
  { value: 'MALE', label: 'Macho' },
] as const;

export type PetFormProps = {
  submitLabel: string;
  onSaved: (pet: PetResponse) => void;
  /** Saves over this pet instead of creating another, like when onboarding comes back to step 1. */
  petId?: string;
};

/**
 * The basic profile of a pet, as in onboarding and "Agregar mascota": photo, name, species,
 * sex, birth date and breed. The rest of the profile (RN-MAS-02) comes with the pet's screen.
 */
export function PetForm({ submitLabel, onSaved, petId }: PetFormProps) {
  const queryClient = useQueryClient();
  const catalog = useCatalogGet();
  const create = usePetsCreate();
  const replace = usePetsReplace();
  const save = petId ? replace : create;
  const [photo, setPhoto] = useState<{ uri: string; fileId: string | null } | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PetValues>({
    resolver: zodResolver(PetFields),
    defaultValues: {
      name: '',
      speciesId: '',
      birthDate: '',
      birthDateIsApproximate: false,
      breed: '',
    },
  });

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;

    setPhoto({ uri: asset.uri, fileId: null });
    setPhotoError(false);
    try {
      const fileId = await uploadFile(asset.uri, asset.mimeType ?? 'image/jpeg', 'PET_PHOTO');
      setPhoto({ uri: asset.uri, fileId });
    } catch {
      setPhoto(null);
      setPhotoError(true);
    }
  };

  const uploading = photo !== null && photo.fileId === null;

  const submit = handleSubmit(({ birthDate, breed, ...form }) => {
    const data = {
      ...form,
      birthDate: parseDate(birthDate)!,
      breed: breed || undefined,
      photoFileId: photo?.fileId ?? undefined,
    };
    const onSuccess = (pet: PetResponse) => {
      void queryClient.invalidateQueries({ queryKey: getPetsListQueryKey() });
      onSaved(pet);
    };
    if (petId) replace.mutate({ petId, data }, { onSuccess });
    else create.mutate({ data }, { onSuccess });
  });

  return (
    <View style={styles.form}>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={photo ? 'Cambiar la foto' : 'Agregar foto'}
        accessibilityState={{ busy: uploading }}
        onPress={pickPhoto}
        disabled={uploading}
        pressedScale={0.95}
        style={styles.photo}
      >
        {photo ? (
          <>
            <Image source={photo.uri} contentFit="cover" style={styles.photoImage} />
            {uploading && (
              <View style={styles.photoBusy}>
                <ActivityIndicator color={colors.card} />
              </View>
            )}
          </>
        ) : (
          <>
            <Icon name="camera" size={28} />
            <Text variant="caption">Agregar foto</Text>
          </>
        )}
      </Touchable>
      {photoError && (
        <Banner
          tone="error"
          message="No pudimos subir la foto. Intenta con otra o sigue sin foto."
        />
      )}

      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <Input
            label="Nombre"
            placeholder="Ej.: Luna"
            autoCapitalize="words"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.name?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="speciesId"
        render={({ field }) => (
          <ChoiceField label="Es un" error={errors.speciesId?.message}>
            {catalog.data?.species.map((species) => (
              <View key={species.id} style={styles.choice}>
                <Chip
                  label={species.name}
                  selected={field.value === species.id}
                  onPress={() => field.onChange(species.id)}
                />
              </View>
            )) ?? <ActivityIndicator color={colors.grapeDeep} />}
          </ChoiceField>
        )}
      />

      <Controller
        control={control}
        name="sex"
        render={({ field }) => (
          <ChoiceField label="Sexo" error={errors.sex?.message}>
            {sexes.map((sex) => (
              <View key={sex.value} style={styles.choice}>
                <Chip
                  label={sex.label}
                  selected={field.value === sex.value}
                  onPress={() => field.onChange(sex.value)}
                />
              </View>
            ))}
          </ChoiceField>
        )}
      />

      <View>
        <Controller
          control={control}
          name="birthDate"
          render={({ field }) => (
            <Input
              label="Fecha de nacimiento"
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              value={field.value}
              onChangeText={(text) => field.onChange(maskDate(text))}
              onBlur={field.onBlur}
              error={errors.birthDate?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="birthDateIsApproximate"
          render={({ field }) => (
            <Checkbox
              label="No sé la fecha exacta, es aproximada"
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </View>

      <Controller
        control={control}
        name="breed"
        render={({ field }) => (
          <Input
            label="Raza"
            optional
            placeholder="Ej.: zaguate, labrador"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.breed?.message}
          />
        )}
      />

      <Banner
        tone="info"
        message="¿Toma medicina o se recupera de una operación? Agrégalo luego en su perfil y te mostramos cuidadores ⭐."
      />

      {save.isError && <Banner tone="error" message={errorMessage(save.error)} />}

      <View style={styles.footer}>
        <Button
          label={submitLabel}
          loading={save.isPending}
          disabled={uploading}
          onPress={() => submit()}
        />
      </View>
    </View>
  );
}

function ChoiceField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text variant="label">{label}</Text>
      <View style={styles.choices}>{children}</View>
      {error && (
        <Text variant="caption" color="roseDeep">
          {error}
        </Text>
      )}
    </View>
  );
}

const PHOTO = 112;

const styles = StyleSheet.create({
  form: { flexGrow: 1, gap: space[4] },
  photo: {
    alignSelf: 'center',
    width: PHOTO,
    height: PHOTO,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
    overflow: 'hidden',
    borderRadius: PHOTO / 2,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
    backgroundColor: colors.grape,
  },
  photoImage: { ...StyleSheet.absoluteFill },
  photoBusy: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 51, 70, 0.4)',
  },
  field: { gap: space[2] },
  choices: { flexDirection: 'row', gap: space[2] },
  choice: { flex: 1 },
  footer: { marginTop: 'auto', paddingTop: space[2] },
});
