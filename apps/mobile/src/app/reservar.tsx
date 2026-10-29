import { zodResolver } from '@hookform/resolvers/zod';
import {
  getBookingsListQueryKey,
  useAddressesList,
  useBookingsCreate,
  useBookingsList,
  useBookingsQuote,
  useCaregiversProfile,
  usePetsList,
  type AddressResponse,
  type BookingEmergency,
  type CaregiverProfileResponse,
  type PetResponse,
} from '@pawie/api-client';
import { BookingsCreateBody } from '@pawie/api-client/zod';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { BottomBar } from '@/components/BottomBar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Checkbox } from '@/components/Checkbox';
import { Chip } from '@/components/Chip';
import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Input } from '@/components/Input';
import { PriceCard } from '@/components/PriceCard';
import { Sheet } from '@/components/Sheet';
import { StepBar } from '@/components/StepBar';
import { Text } from '@/components/Text';
import { Touchable } from '@/components/Touchable';
import { errorMessage } from '@/lib/api';
import { firstName, joinNames, serviceName } from '@/lib/bookings';
import { formatDay, formatMoney, formatRange, maskPhone, parsePhone } from '@/lib/format';
import { toSearchRequest, useSearch, useSearchResults, type Search } from '@/lib/search';
import { colors, radius, space } from '@/theme/tokens';

const AMOUNTS = [50, 100, 200];

const optionalPhone = z.string().refine((text) => text === '' || parsePhone(text) !== null, {
  message: 'Escribe un teléfono de 8 dígitos, como 7000 0000.',
});

const BookingFields = z.object({
  instructions: z.string().trim().max(2000),
  contactName: BookingsCreateBody.shape.emergency.shape.contactName.trim().min(1),
  contactPhone: optionalPhone.refine((text) => text !== '', { message: 'Completa este campo.' }),
  vetName: z.string().trim().max(120),
  vetPhone: optionalPhone,
  amount: z.number(),
  // RN-RES-04: without it there is no booking.
  consent: z.boolean().refine((value) => value, {
    message: 'Marca esta casilla para enviar la solicitud.',
  }),
});

type BookingValues = z.infer<typeof BookingFields>;

export default function BookScreen() {
  const { caregiverId } = useLocalSearchParams<{ caregiverId: string }>();
  const search = useSearch();
  const profile = useCaregiversProfile(caregiverId);
  const results = useSearchResults(search);
  const pets = usePetsList();
  const addresses = useAddressesList();
  const bookings = useBookingsList();

  const queries = [profile, results, pets, addresses, bookings];
  const failed = queries.find((query) => query.isError);
  if (!search || failed || queries.some((query) => query.isPending)) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        {!search || failed ? (
          <View style={styles.error}>
            <Banner
              tone="error"
              message={
                failed ? errorMessage(failed.error) : 'Vuelve a buscar cuidadores para reservar.'
              }
            />
            <Button variant="secondary" label="Volver" onPress={() => router.back()} />
          </View>
        ) : (
          <ActivityIndicator color={colors.grapeDeep} />
        )}
      </SafeAreaView>
    );
  }

  const match = results.data!.results.find((result) => result.id === caregiverId);
  const price = match?.prices.find((p) => p.serviceCode === search.serviceCode);
  if (!match || !price) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <View style={styles.error}>
          <Banner
            tone="warning"
            message="Este cuidador ya no está disponible para tu búsqueda. Prueba con otro horario."
          />
          <Button variant="secondary" label="Volver" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <BookingForm
      search={search}
      caregiver={profile.data!}
      slot={results.data!.slots[0]}
      pets={pets.data!.filter((pet) => search.petIds.includes(pet.id))}
      addresses={addresses.data!}
      // The list starts with the most recent booking: its emergency details are the latest.
      previous={bookings.data![0]?.emergency ?? null}
    />
  );
}

function BookingForm({
  search,
  caregiver,
  slot,
  pets,
  addresses,
  previous,
}: {
  search: Search;
  caregiver: CaregiverProfileResponse;
  slot: { startsAt: string; endsAt: string };
  pets: PetResponse[];
  addresses: AddressResponse[];
  previous: BookingEmergency | null;
}) {
  const queryClient = useQueryClient();
  const create = useBookingsCreate();
  const quote = useBookingsQuote();
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? null);
  const [choosingAddress, setChoosingAddress] = useState(false);
  // The first booking asks for the emergency details; the next ones reuse the last ones.
  const [editingEmergency, setEditingEmergency] = useState(previous === null);
  const name = firstName(caregiver.displayName);
  const petNames = joinNames(pets.map((pet) => pet.name));
  const overnight = search.serviceCode === 'OVERNIGHT_STAY';
  const address = addresses.find((a) => a.id === addressId);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<BookingValues>({
    resolver: zodResolver(BookingFields),
    defaultValues: {
      instructions: '',
      contactName: previous?.contactName ?? '',
      contactPhone: maskPhone(previous?.contactPhone.replace(/^\+503/, '') ?? ''),
      vetName: previous?.vetName ?? '',
      vetPhone: maskPhone(previous?.vetPhone?.replace(/^\+503/, '') ?? ''),
      amount: previous ? previous.preauthorizedCents / 100 : 100,
      consent: previous?.clinicConsent ?? false,
    },
  });
  const consent = useWatch({ control, name: 'consent' });

  // RN-PRE-10: the API calculates the total, and asks again if the address changes.
  const requestQuote = quote.mutate;
  const askQuote = useCallback(() => {
    if (!addressId) return;
    const { serviceCode, petIds, visits, nights } = toSearchRequest(search);
    requestQuote({
      data: { serviceCode, petIds, visits, nights, caregiverId: caregiver.id, addressId },
    });
  }, [search, caregiver.id, addressId, requestQuote]);
  useEffect(askQuote, [askQuote]);

  const submit = handleSubmit(
    (form) => {
      if (!addressId) {
        setChoosingAddress(true);
        return;
      }
      // The booking takes the district from the address.
      const { serviceCode, petIds, visits, nights } = toSearchRequest(search);
      create.mutate(
        {
          data: {
            serviceCode,
            petIds,
            visits,
            nights,
            caregiverId: caregiver.id,
            addressId,
            instructions: form.instructions || undefined,
            emergency: {
              contactName: form.contactName,
              contactPhone: parsePhone(form.contactPhone)!,
              vetName: form.vetName || undefined,
              vetPhone: form.vetPhone ? parsePhone(form.vetPhone)! : undefined,
              preauthorizedCents: form.amount * 100,
              clinicConsent: true,
            },
          },
        },
        {
          onSuccess: (booking) => {
            void queryClient.invalidateQueries({ queryKey: getBookingsListQueryKey() });
            router.replace(`/reservas/${booking.id}`);
          },
        },
      );
    },
    // An error in the hidden emergency details has to be seen to be fixed.
    (invalid) => {
      if (invalid.contactName || invalid.contactPhone || invalid.vetPhone) {
        setEditingEmergency(true);
      }
    },
  );

  const steps = ['Solicitar', `${name} responde`, 'Pagar'];

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <IconButton
                icon="chevron-left"
                accessibilityLabel={`Volver al perfil de ${name}`}
                onPress={() => router.back()}
              />
              <Text variant="title" accessibilityRole="header">
                {overnight ? 'Solicitar pernocta' : 'Solicitar visita'}
              </Text>
            </View>
            <StepBar current={1} steps={steps} />
          </View>

          <Card style={styles.summary}>
            <View style={[styles.summaryRow, styles.divider]}>
              <Avatar name={caregiver.displayName} photoUrl={caregiver.photoUrl} />
              <View style={styles.flex}>
                <Text variant="bodyStrong">{caregiver.displayName}</Text>
                <Text variant="caption" color="inkMuted">
                  {caregiver.hasSpecialCareCertification && '⭐ Con certificación · '}
                  {serviceName(search.serviceCode)}
                </Text>
              </View>
            </View>
            <SummaryRow
              icon="paw-print"
              label="Para"
              value={petNames}
              action="Cambiar mascota"
              onAction={() => router.dismissAll()}
            />
            <SummaryRow
              icon="calendar"
              label="Cuándo"
              value={
                overnight
                  ? `Noche del ${formatDay(slot.startsAt)}`
                  : formatRange(slot.startsAt, slot.endsAt)
              }
              action="Cambiar fecha y hora"
              onAction={() => router.dismissAll()}
            />
            <SummaryRow
              icon="house"
              label="Dónde"
              value={address ? `${address.label} · ${address.street}` : 'Agrega una dirección'}
              action="Cambiar dirección"
              onAction={() => setChoosingAddress(true)}
              last
            />
          </Card>

          <Controller
            control={control}
            name="instructions"
            render={({ field }) => (
              <Input
                label={`Instrucciones para ${name}`}
                optional
                multiline
                placeholder={`Ej.: ${pets[0]?.name ?? 'Luna'} come a las 9:00 y le dan miedo los cohetes.`}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.instructions?.message}
              />
            )}
          />

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.flex}>
                <Text variant="heading" accessibilityRole="header">
                  Si hay una emergencia
                </Text>
                <Text variant="caption" color="inkMuted">
                  {editingEmergency
                    ? `Solo se usan si ${petNames} necesita atención urgente.`
                    : 'Los mismos de tu última visita.'}
                </Text>
              </View>
              {!editingEmergency && (
                <Button variant="ghost" label="Editar" onPress={() => setEditingEmergency(true)} />
              )}
            </View>

            {editingEmergency ? (
              <Animated.View entering={FadeIn.duration(250)}>
                <Card style={styles.emergency}>
                  <Controller
                    control={control}
                    name="contactName"
                    render={({ field }) => (
                      <Input
                        label="Contacto de emergencia"
                        placeholder="Nombre de alguien de confianza"
                        autoComplete="name"
                        value={field.value}
                        onChangeText={field.onChange}
                        onBlur={field.onBlur}
                        error={errors.contactName?.message}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="contactPhone"
                    render={({ field }) => (
                      <Input
                        label="Su teléfono"
                        prefix="+503"
                        placeholder="7000 0000"
                        keyboardType="phone-pad"
                        value={field.value}
                        onChangeText={(text) => field.onChange(maskPhone(text))}
                        onBlur={field.onBlur}
                        error={errors.contactPhone?.message}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="vetName"
                    render={({ field }) => (
                      <Input
                        label="Veterinario"
                        optional
                        placeholder="Nombre o clínica"
                        value={field.value}
                        onChangeText={field.onChange}
                        onBlur={field.onBlur}
                        error={errors.vetName?.message}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="vetPhone"
                    render={({ field }) => (
                      <Input
                        label="Teléfono del veterinario"
                        optional
                        prefix="+503"
                        placeholder="2200 0000"
                        keyboardType="phone-pad"
                        value={field.value}
                        onChangeText={(text) => field.onChange(maskPhone(text))}
                        onBlur={field.onBlur}
                        error={errors.vetPhone?.message}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="amount"
                    render={({ field }) => (
                      <View style={styles.amounts}>
                        <Text variant="label">Monto que autorizas para una clínica</Text>
                        <View style={styles.row}>
                          {AMOUNTS.map((amount) => (
                            <View key={amount} style={styles.flex}>
                              <Chip
                                label={`$${amount}`}
                                selected={field.value === amount}
                                onPress={() => field.onChange(amount)}
                              />
                            </View>
                          ))}
                        </View>
                        <Text variant="caption" color="inkMuted">
                          No te cobramos nada ahora. Lo guardamos para tus próximas visitas.
                        </Text>
                      </View>
                    )}
                  />
                </Card>
              </Animated.View>
            ) : (
              <EmergencySummary previous={previous!} />
            )}

            <Controller
              control={control}
              name="consent"
              render={({ field }) => (
                <View style={[styles.consent, !field.value && styles.consentMissing]}>
                  <Checkbox
                    label={`Autorizo que lleven a ${petNames} a una clínica si hay una emergencia.`}
                    checked={field.value}
                    onChange={field.onChange}
                  />
                </View>
              )}
            />
            {!consent && (
              <View style={styles.consentHint}>
                <Icon name="circle-alert" size={16} color="roseDeep" />
                <Text variant="caption" color="roseDeep">
                  Marca esta casilla para enviar la solicitud.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            {quote.data ? (
              <PriceCard
                price={quote.data}
                lines={[
                  {
                    label: `${overnight ? 'Pernocta' : 'Visita'}${pets.length > 1 ? ` · ${pets.length} mascotas` : ''}`,
                    amountCents: quote.data.subtotalCents,
                  },
                ]}
              />
            ) : quote.isError ? (
              <>
                <Banner tone="error" message={errorMessage(quote.error)} />
                <Button variant="secondary" label="Calcular de nuevo" onPress={askQuote} />
              </>
            ) : (
              <ActivityIndicator color={colors.grapeDeep} />
            )}
            <Banner
              tone="info"
              message={
                caregiver.instantBooking
                  ? `Todavía no pagas. ${name} acepta al instante: al enviarla, tendrás 2 horas para pagar.`
                  : `Todavía no pagas. Cuando ${name} acepte, tendrás 2 horas para pagar.`
              }
            />
            {create.isError && <Banner tone="error" message={errorMessage(create.error)} />}
          </View>
        </ScrollView>

        <BottomBar caption="Total" amount={quote.data ? formatMoney(quote.data.totalCents) : '—'}>
          <Button
            label="Enviar solicitud"
            disabled={!consent || !quote.data}
            loading={create.isPending}
            onPress={() => submit()}
          />
        </BottomBar>
      </KeyboardAvoidingView>

      <Sheet
        visible={choosingAddress}
        onClose={() => setChoosingAddress(false)}
        title="¿Dónde será?"
        footer={
          <Button
            variant="secondary"
            label="Agregar otra dirección"
            onPress={() => {
              setChoosingAddress(false);
              router.push('/direcciones/nueva');
            }}
          />
        }
      >
        {addresses.length === 0 && (
          <Text color="inkMuted">Agrega la dirección donde tu cuidador hará la visita.</Text>
        )}
        {addresses.map((option) => (
          <Touchable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: option.id === addressId }}
            onPress={() => {
              setAddressId(option.id);
              setChoosingAddress(false);
            }}
            pressedScale={0.98}
            style={[styles.addressOption, option.id === addressId && styles.addressSelected]}
          >
            <Icon name="map-pin" />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{option.label}</Text>
              <Text variant="caption" color="inkMuted">
                {option.street} · {option.district.name}
              </Text>
            </View>
            {option.id === addressId && <Icon name="check" color="grapeDeep" />}
          </Touchable>
        ))}
      </Sheet>
    </SafeAreaView>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  action,
  onAction,
  last = false,
}: {
  icon: IconName;
  label: string;
  value: string;
  /** Says what "Cambiar" changes, for screen readers. */
  action: string;
  onAction: () => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.summaryRow, !last && styles.divider]}>
      <Icon name={icon} />
      <View style={styles.flex}>
        <Text variant="caption" color="inkMuted">
          {label}
        </Text>
        <Text variant="bodyStrong">{value}</Text>
      </View>
      <Button variant="ghost" label="Cambiar" accessibilityLabel={action} onPress={onAction} />
    </View>
  );
}

function EmergencySummary({ previous }: { previous: BookingEmergency }) {
  return (
    <Card style={styles.emergencySummary}>
      <Text>
        <Text variant="bodyStrong">{previous.contactName}</Text> ·{' '}
        {maskPhone(previous.contactPhone.replace(/^\+503/, ''))}
      </Text>
      <Text variant="caption" color="inkMuted">
        {previous.vetName ? `Veterinario: ${previous.vetName} · ` : ''}Autorizas hasta{' '}
        {formatMoney(previous.preauthorizedCents, { short: true })}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  centered: { alignItems: 'center', justifyContent: 'center' },
  error: { alignSelf: 'stretch', gap: space[4], padding: space[4] },
  content: { gap: space[6], padding: space[4], paddingBottom: space[8] },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: space[2] },
  header: { gap: space[4] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  summary: { paddingVertical: space[1] },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  section: { gap: space[3] },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  emergency: { gap: space[4] },
  emergencySummary: { gap: space[2] },
  amounts: { gap: space[2] },
  consent: { padding: space[3], borderRadius: radius.sm, backgroundColor: colors.card },
  consentMissing: { backgroundColor: colors.rose },
  consentHint: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: -space[1] },
  addressOption: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radius.sm,
  },
  addressSelected: { backgroundColor: colors.grape },
});
