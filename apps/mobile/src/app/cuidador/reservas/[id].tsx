import {
  useBookingsAccept,
  useBookingsReject,
  useCaregiverBookingsGet,
  useCatalogGet,
  type BookingPetProfile,
  type CaregiverBookingResponse,
  type CareNeedResponse,
} from '@pawie/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import type { ReactNode } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { BottomBar } from '@/components/BottomBar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Row } from '@/components/Row';
import { Status } from '@/components/Status';
import { Text } from '@/components/Text';
import { errorMessage } from '@/lib/api';
import { firstName, formatWhen, joinNames, serviceKind } from '@/lib/bookings';
import { caregiverBookingChanged, caregiverStatusTag } from '@/lib/caregiver-bookings';
import {
  capitalize,
  formatDate,
  formatDateSpan,
  formatDeadline,
  formatMinute,
  formatMoney,
  formatPhone,
} from '@/lib/format';
import { describeBody, describePet } from '@/lib/pets';
import { services } from '@/theme/services';
import { colors, gutter, radius, space } from '@/theme/tokens';

// RN-MAS-02: "Medicamentos que toma" only informs. The caregiver gives only what is a task.
const MEDICATIONS_NOTE =
  'Lo informa el dueño. Solo das las medicinas que están en las tareas del servicio.';

/**
 * CuiSolicitud (RN-RES-11), and the booking once it's answered: what the caregiver gets first,
 * then the service, the pets with their profile for those dates, and Aceptar or Rechazar. The
 * exact address and the emergency details show once the owner pays (RN-CTA-04).
 */
export default function CaregiverBookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useCaregiverBookingsGet(id);

  if (!booking.data) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        {booking.isError ? (
          <View style={styles.padded}>
            <Banner tone="error" message={errorMessage(booking.error)} />
            <Button variant="secondary" label="Volver" onPress={() => router.back()} />
          </View>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </SafeAreaView>
    );
  }
  return <BookingDetail booking={booking.data} />;
}

function BookingDetail({ booking }: { booking: CaregiverBookingResponse }) {
  const accept = useBookingsAccept();
  const reject = useBookingsReject();
  const owner = firstName(booking.owner.displayName);
  const isRequest = booking.status === 'REQUESTED';
  const answering = accept.isPending || reject.isPending;
  const failed = accept.error ?? reject.error;

  const onAccept = () =>
    accept.mutate({ bookingId: booking.id }, { onSuccess: caregiverBookingChanged });
  const onReject = () =>
    Alert.alert(
      '¿Rechazar la solicitud?',
      `${owner} verá que no puedes, y el horario queda libre.`,
      [
        { text: 'No, volver', style: 'cancel' },
        {
          text: 'Sí, rechazar',
          style: 'destructive',
          onPress: () =>
            reject.mutate(
              { bookingId: booking.id, data: {} },
              { onSuccess: caregiverBookingChanged },
            ),
        },
      ],
    );

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <IconButton
            icon="chevron-left"
            accessibilityLabel="Volver"
            onPress={() => router.back()}
          />
          <View style={styles.flex}>
            <Text variant="title" accessibilityRole="header">
              {isRequest ? 'Nueva solicitud' : serviceKind(booking)}
            </Text>
            <Status {...caregiverStatusTag(booking)} />
          </View>
        </View>

        <Earnings booking={booking} />

        {booking.status === 'PENDING_PAYMENT' && booking.paymentDueAt && (
          <Banner
            tone="info"
            icon="clock"
            message={`${owner} paga ${formatDeadline(booking.paymentDueAt)}. Si no paga a tiempo, la reserva vence y el horario queda libre.`}
          />
        )}

        <Summary booking={booking} owner={owner} />

        {booking.emergency && (
          <Emergency
            emergency={booking.emergency}
            pets={joinNames(booking.pets.map(({ name }) => name))}
          />
        )}

        {booking.pets.map((pet) => (
          <PetProfile key={pet.id} pet={pet} />
        ))}
      </ScrollView>

      {isRequest && (
        <BottomBar>
          <View style={styles.answer}>
            {failed && <Banner tone="error" message={errorMessage(failed)} />}
            <View style={styles.buttons}>
              <View style={styles.flex}>
                <Button
                  variant="secondary"
                  label="Rechazar"
                  disabled={answering}
                  loading={reject.isPending}
                  onPress={onReject}
                />
              </View>
              <View style={styles.flex}>
                <Button
                  label="Aceptar"
                  disabled={answering}
                  loading={accept.isPending}
                  onPress={onAccept}
                />
              </View>
            </View>
          </View>
        </BottomBar>
      )}
    </SafeAreaView>
  );
}

/** RN-RES-11, RN-PRE-04: the amount the API returns, big and before the details. */
function Earnings({ booking }: { booking: CaregiverBookingResponse }) {
  const { payoutCents, subtotalCents, commissionCents } = booking.earnings;
  const isRequest = booking.status === 'REQUESTED';
  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      accessible
      accessibilityLabel={`${isRequest ? 'Vas a ganar' : 'Ganas'} ${formatMoney(payoutCents)}`}
      style={styles.earnings}
    >
      <Text variant="caption" color="inkMuted">
        {isRequest ? 'Vas a ganar' : 'Ganas'}
      </Text>
      <Text variant="display">{formatMoney(payoutCents)}</Text>
      {commissionCents > 0 && (
        <Text variant="caption" color="inkMuted">
          {`Tu precio, ${formatMoney(subtotalCents)}, menos la comisión de ${formatMoney(commissionCents)}`}
        </Text>
      )}
    </Animated.View>
  );
}

/** The service, when, where and the owner's instructions for it (RN-RES-03). */
function Summary({ booking, owner }: { booking: CaregiverBookingResponse; owner: string }) {
  const { color, icon } = services[booking.serviceCode];
  const pets = joinNames(booking.pets.map(({ name }) => name));
  return (
    <Card style={styles.summary}>
      <SummaryRow>
        <View style={[styles.serviceIcon, { backgroundColor: colors[color] }]}>
          <Icon name={icon} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">
            {serviceKind(booking)} para {pets}
          </Text>
          <Text variant="caption" color="inkMuted">
            De {booking.owner.displayName}
          </Text>
        </View>
      </SummaryRow>
      <SummaryRow icon="calendar">
        <View style={styles.flex}>
          {booking.slots.length > 1 ? (
            booking.slots.map((slot) => <Text key={slot.startsAt}>{formatWhen(slot)}</Text>)
          ) : (
            <Text>{formatWhen(booking)}</Text>
          )}
        </View>
      </SummaryRow>
      <SummaryRow icon="map-pin" last={!booking.instructions}>
        {booking.address ? (
          <View style={styles.flex}>
            <Text>{booking.address.street}</Text>
            <Text variant="caption" color="inkMuted">
              {[booking.address.details, booking.district.name].filter(Boolean).join(', ')}
            </Text>
          </View>
        ) : (
          <View style={styles.flex}>
            <Text>{booking.district.name}</Text>
            <Text variant="caption" color="inkMuted">
              Ves la dirección exacta cuando {owner} pague.
            </Text>
          </View>
        )}
      </SummaryRow>
      {booking.instructions && (
        <SummaryRow icon="file-text" last>
          <View style={styles.flex}>
            <Text variant="caption" color="inkMuted">
              Instrucciones de {owner} para este servicio
            </Text>
            <Text>{booking.instructions}</Text>
          </View>
        </SummaryRow>
      )}
    </Card>
  );
}

/** RN-RES-04: shown once the booking is confirmed (RN-CTA-04). */
function Emergency({
  emergency,
  pets,
}: {
  emergency: NonNullable<CaregiverBookingResponse['emergency']>;
  pets: string;
}) {
  const vet = [emergency.vetName, emergency.vetPhone && formatPhone(emergency.vetPhone)]
    .filter(Boolean)
    .join(', ');
  return (
    <View style={styles.section}>
      <Text variant="heading" accessibilityRole="header">
        Si hay una emergencia
      </Text>
      <Facts
        facts={[
          {
            label: 'Contacto de emergencia',
            value: `${emergency.contactName}, ${formatPhone(emergency.contactPhone)}`,
          },
          { label: 'Veterinario', value: vet },
          {
            label: 'Monto preautorizado',
            value: `${formatMoney(emergency.preauthorizedCents)}${emergency.clinicConsent ? `. Autoriza llevar a ${pets} a una clínica.` : ''}`,
          },
        ]}
      />
    </View>
  );
}

/** RN-RES-11: the pet's profile for the booking's dates, with heat and Special up front. */
function PetProfile({ pet }: { pet: BookingPetProfile }) {
  const catalog = useCatalogGet();
  const taskName = (need: CareNeedResponse) =>
    catalog.data?.careTasks.find(({ code }) => code === need.task)?.name ?? '';
  const instructionsOf = (need: CareNeedResponse) =>
    pet.vetInstructions.find(({ id }) => id === need.vetInstructionId);

  const routine = [
    { label: 'Alimento', value: pet.foodDescription },
    { label: 'Porción', value: pet.foodPortion },
    { label: 'Premios permitidos', value: pet.allowedTreats },
    { label: 'Rutina diaria', value: pet.dailyRoutine },
    { label: 'Temperamento', value: pet.temperament },
    { label: 'Notas de manejo', value: pet.handlingNotes },
  ];
  const vet = [pet.vetName, pet.vetClinic, pet.vetPhone && formatPhone(pet.vetPhone)]
    .filter(Boolean)
    .join(', ');
  const health = [
    { label: 'Veterinario de cabecera', value: vet },
    { label: 'Condiciones de salud', value: pet.healthConditions },
  ];

  return (
    <View style={styles.pet}>
      <View style={styles.petHeader}>
        <Avatar name={pet.name} photoUrl={pet.photoUrl} size={56} />
        <View style={styles.flex}>
          <Text variant="heading" accessibilityRole="header">
            {pet.name}
          </Text>
          <Text variant="caption" color="inkMuted">
            {describePet(pet)}
          </Text>
          <Text variant="caption" color="inkMuted">
            {describeBody(pet)}
          </Text>
        </View>
      </View>

      {pet.careLevel === 'SPECIAL' && (
        <Banner
          tone="info"
          icon="shield-check"
          message={`${pet.name} es Especial: tiene tareas de cuidado especial en estas fechas.`}
        />
      )}
      {pet.inHeat && pet.heatStartsOn && (
        <Banner
          tone="info"
          message={`${pet.name} está en celo ${formatDateSpan(pet.heatStartsOn, pet.heatEndsOn)}. Atiéndela sin aislarla, como en el curso de bienvenida.`}
        />
      )}

      {pet.careNeeds.length > 0 && (
        <Part title="Tareas de cuidado">
          {pet.careNeeds.map((need, index) => {
            const document = instructionsOf(need);
            const fileUrl = document?.fileUrl;
            return (
              <Row
                key={need.id}
                divider={index > 0}
                onPress={fileUrl ? () => WebBrowser.openBrowserAsync(fileUrl) : undefined}
                accessibilityLabel={
                  fileUrl ? `${taskName(need)}. Abrir las indicaciones del veterinario` : undefined
                }
              >
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{taskName(need)}</Text>
                  <Text variant="caption" color="inkMuted">
                    {capitalize(formatDateSpan(need.startsOn, need.endsOn))}
                  </Text>
                  {document ? (
                    <Text variant="caption" color="primary">
                      Indicaciones del veterinario del {formatDate(document.issuedOn)}
                    </Text>
                  ) : (
                    need.ownerInstructions && (
                      <Text variant="caption">{need.ownerInstructions}</Text>
                    )
                  )}
                </View>
                {fileUrl && <Icon name="chevron-right" color="inkMuted" />}
              </Row>
            );
          })}
        </Part>
      )}

      {pet.scheduleItems.length > 0 && (
        <Part title="Horarios de comida y medicinas">
          {pet.scheduleItems.map((item, index) => (
            <Row key={item.id} divider={index > 0}>
              <Text variant="subheading" style={styles.time}>
                {formatMinute(item.minuteOfDay)}
              </Text>
              <Icon name={item.kind === 'MEDICATION' ? 'pill' : 'utensils'} color="inkMuted" />
              <View style={styles.flex}>
                <Text variant="bodyStrong">{item.label}</Text>
                {(item.dose ?? (item.kind === 'MEAL' && pet.foodPortion)) && (
                  <Text variant="caption" color="inkMuted">
                    {item.dose ?? pet.foodPortion}
                  </Text>
                )}
              </View>
            </Row>
          ))}
        </Part>
      )}

      {routine.some(({ value }) => value) && (
        <Part title="Rutina">
          <Facts facts={routine} />
        </Part>
      )}

      {(health.some(({ value }) => value) || pet.medications) && (
        <Part title="Salud">
          <Facts facts={health} />
          {pet.medications && (
            <Row divider={health.some(({ value }) => value)}>
              <View style={styles.flex}>
                <Text variant="caption" color="inkMuted">
                  Medicamentos que toma
                </Text>
                <Text>{pet.medications}</Text>
                <Text variant="footnote" color="inkMuted">
                  {MEDICATIONS_NOTE}
                </Text>
              </View>
            </Row>
          )}
        </Part>
      )}
    </View>
  );
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.part}>
      <Text variant="subheading" accessibilityRole="header">
        {title}
      </Text>
      <View>{children}</View>
    </View>
  );
}

/** The fields that have something, one per row: the label small and the value under it. */
function Facts({ facts }: { facts: { label: string; value: string | null }[] }) {
  return facts
    .filter((fact): fact is { label: string; value: string } => Boolean(fact.value))
    .map(({ label, value }, index) => (
      <Row key={label} divider={index > 0}>
        <View style={styles.flex}>
          <Text variant="caption" color="inkMuted">
            {label}
          </Text>
          <Text>{value}</Text>
        </View>
      </Row>
    ));
}

function SummaryRow({
  icon,
  last = false,
  children,
}: {
  icon?: IconName;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={[styles.row, !last && styles.divider]}>
      {icon && <Icon name={icon} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  padded: { alignSelf: 'stretch', gap: space[4], padding: space[4] },
  content: {
    gap: space[6],
    paddingHorizontal: gutter,
    paddingTop: space[1],
    paddingBottom: space[8],
  },
  flex: { flex: 1, gap: 2 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  earnings: {
    gap: space[1],
    padding: space[5],
    borderRadius: radius.lg,
    backgroundColor: colors.tint,
  },
  summary: { paddingVertical: space[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3] },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  serviceIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  section: { gap: space[1] },
  pet: { gap: space[4] },
  petHeader: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  part: { gap: space[1] },
  time: { width: 56 },
  answer: { gap: space[3] },
  buttons: { flexDirection: 'row', gap: space[3] },
});
