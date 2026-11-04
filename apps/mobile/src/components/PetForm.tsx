import { zodResolver } from '@hookform/resolvers/zod';
import {
  getPetsListQueryKey,
  useCatalogGet,
  usePetsCreate,
  usePetsReplace,
  type PetDetail,
  type PetResponse,
} from '@pawie/api-client';
import { PetsCreateBody } from '@pawie/api-client/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { errorMessage } from '@/lib/api';
import { uploadFile } from '@/lib/files';
import { localDate, maskDate, parseDate, toDateInput } from '@/lib/format';
import { formatKilos, petChanged, petRequest } from '@/lib/pets';
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
  /** In kilos, with a dot or a comma: "12,5". Only when editing a pet. */
  weight: z.string().refine(
    (text) => {
      const kilos = parseKilos(text);
      return text.trim() === '' || (kilos !== null && kilos > 0 && kilos <= 150);
    },
    { message: 'Escribe el peso en kilos, como 12.5.' },
  ),
  sterilized: z.enum(['YES', 'NO', 'UNKNOWN']),
});

type PetValues = z.infer<typeof PetFields>;

const sexes = [
  { value: 'FEMALE', label: 'Hembra' },
  { value: 'MALE', label: 'Macho' },
] as const;

const sterilizedOptions = [
  { value: 'YES', label: 'Sí' },
  { value: 'NO', label: 'No' },
  { value: 'UNKNOWN', label: 'No sé' },
] as const;

/** "12,5" or "12.5" is 12.5. Null if it isn't a number. */
function parseKilos(text: string): number | null {
  const kilos = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(kilos) ? kilos : null;
}

export type PetFormProps = {
  submitLabel: string;
  onSaved: (pet: PetResponse) => void;
  /** Saves over this pet instead of creating another, like when onboarding comes back to step 1. */
  petId?: string;
  /**
   * Edits this pet from MascotaPerfil: starts with its data, adds its weight and whether it's
   * sterilized, and keeps the rest of its profile as it is.
   */
  pet?: PetDetail;
};

/**
 * The basic profile of a pet, as in onboarding and "Agregar mascota": photo, name, species,
 * sex, birth date and breed. The rest of the profile (RN-MAS-02) is edited in MascotaPerfil.
 */
export function PetForm({ submitLabel, onSaved, petId, pet }: PetFormProps) {
  const queryClient = useQueryClient();
  const catalog = useCatalogGet();
  const create = usePetsCreate();
  const replace = usePetsReplace();
  const save = petId || pet ? replace : create;
  const [photo, setPhoto] = useState<{ uri: string; fileId: string | null } | null>(
    pet?.photoUrl && pet.photoFileId ? { uri: pet.photoUrl, fileId: pet.photoFileId } : null,
  );
  const [photoError, setPhotoError] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PetValues>({
    resolver: zodResolver(PetFields),
    defaultValues: {
      name: pet?.name ?? '',
      speciesId: pet?.species.id ?? '',
      sex: pet?.sex,
      birthDate: pet ? toDateInput(pet.birthDate) : '',
      birthDateIsApproximate: pet?.birthDateIsApproximate ?? false,
      breed: pet?.breed ?? '',
      weight: pet?.weightGrams ? formatKilos(pet.weightGrams) : '',
      sterilized: pet?.isSterilized == null ? 'UNKNOWN' : pet.isSterilized ? 'YES' : 'NO',
    },
  });

  const sex = useWatch({ control, name: 'sex' });

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

  const submit = handleSubmit(({ birthDate, breed, weight, sterilized, ...form }) => {
    const data = {
      ...form,
      birthDate: parseDate(birthDate)!,
      breed: breed || undefined,
      photoFileId: photo?.fileId ?? undefined,
    };
    if (pet) {
      const kilos = parseKilos(weight);
      replace.mutate(
        {
          petId: pet.id,
          data: petRequest(pet, {
            ...data,
            weightGrams: kilos === null ? undefined : Math.round(kilos * 1000),
            isSterilized: sterilized === 'UNKNOWN' ? undefined : sterilized === 'YES',
          }),
        },
        {
          onSuccess: (saved) => {
            petChanged(pet.id, saved);
            onSaved(saved);
          },
        },
      );
      return;
    }
    const onSuccess = (saved: PetResponse) => {
      void queryClient.invalidateQueries({ queryKey: getPetsListQueryKey() });
      onSaved(saved);
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
                <ActivityIndicator color={colors.white} />
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
            )) ?? <ActivityIndicator color={colors.primary} />}
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

      {pet ? (
        <>
          <Controller
            control={control}
            name="weight"
            render={({ field }) => (
              <Input
                label="Peso en kilos"
                optional
                placeholder="Ej.: 12.5"
                keyboardType="decimal-pad"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.weight?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="sterilized"
            render={({ field }) => (
              <ChoiceField label={sex === 'MALE' ? '¿Está esterilizado?' : '¿Está esterilizada?'}>
                {sterilizedOptions.map((option) => (
                  <View key={option.value} style={styles.choice}>
                    <Chip
                      label={option.label}
                      selected={field.value === option.value}
                      onPress={() => field.onChange(option.value)}
                    />
                  </View>
                ))}
              </ChoiceField>
            )}
          />
        </>
      ) : (
        <Banner
          tone="info"
          message="¿Toma medicina o se recupera de una operación? Agrégalo luego en su perfil y te mostramos cuidadores ⭐."
        />
      )}

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
        <Text variant="caption" color="danger">
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
    borderColor: colors.inkMuted,
    backgroundColor: colors.tint,
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
