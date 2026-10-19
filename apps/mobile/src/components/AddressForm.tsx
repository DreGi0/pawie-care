import { zodResolver } from '@hookform/resolvers/zod';
import {
  getAddressesListQueryKey,
  useAddressesCreate,
  useCatalogGet,
  type AddressResponse,
} from '@pawie/api-client';
import { AddressesCreateBody } from '@pawie/api-client/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { errorMessage } from '@/lib/api';
import { space } from '@/theme/tokens';

import { Banner } from './Banner';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';

const AddressFields = z.object({
  districtId: z.string().min(1, 'Elige el distrito.'),
  street: AddressesCreateBody.shape.street.trim().min(1),
  details: z.string().trim().max(300),
});

type AddressValues = z.infer<typeof AddressFields>;

export type AddressFormProps = {
  submitLabel: string;
  onSaved: (address: AddressResponse) => void;
};

/** Where the visits happen. It's saved as "Casa": the owner doesn't name it yet. */
export function AddressForm({ submitLabel, onSaved }: AddressFormProps) {
  const queryClient = useQueryClient();
  const catalog = useCatalogGet();
  const create = useAddressesCreate();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AddressValues>({
    resolver: zodResolver(AddressFields),
    defaultValues: { districtId: '', street: '', details: '' },
  });

  const submit = handleSubmit(({ details, ...form }) =>
    create.mutate(
      { data: { ...form, label: 'Casa', details: details || undefined } },
      {
        onSuccess: (address) => {
          void queryClient.invalidateQueries({ queryKey: getAddressesListQueryKey() });
          onSaved(address);
        },
      },
    ),
  );

  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="districtId"
        render={({ field }) => (
          <Select
            label="Distrito"
            placeholder="Elige tu distrito"
            value={field.value || null}
            options={(catalog.data?.districts ?? []).map((d) => ({ value: d.id, label: d.name }))}
            onChange={field.onChange}
            error={errors.districtId?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="street"
        render={({ field }) => (
          <Input
            label="Dirección"
            placeholder="Colonia, calle y número de casa"
            autoComplete="street-address"
            textContentType="fullStreetAddress"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.street?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="details"
        render={({ field }) => (
          <Input
            label="Referencias"
            optional
            placeholder="Ej.: portón negro, frente al parque"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.details?.message}
          />
        )}
      />

      <Banner
        tone="success"
        icon="lock"
        message="Tu cuidador ve esta dirección solo cuando la visita está confirmada y pagada."
      />

      {create.isError && <Banner tone="error" message={errorMessage(create.error)} />}

      <View style={styles.footer}>
        <Button label={submitLabel} loading={create.isPending} onPress={() => submit()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { flexGrow: 1, gap: space[4] },
  footer: { marginTop: 'auto', paddingTop: space[2] },
});
