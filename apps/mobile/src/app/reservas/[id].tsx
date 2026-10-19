import {
  getBookingsGetQueryKey,
  getBookingsListQueryKey,
  useBookingsCancel,
  useBookingsGet,
  usePaymentsStart,
  type BookingResponse,
} from '@pawie/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Nimbus } from '@/components/Nimbus';
import { StepBar } from '@/components/StepBar';
import { Tag } from '@/components/Tag';
import { Text } from '@/components/Text';
import { errorMessage } from '@/lib/api';
import { firstName, joinNames, serviceName, statusTag } from '@/lib/bookings';
import {
  formatDay,
  formatDeadline,
  formatLongDayTime,
  formatMoney,
  formatRange,
} from '@/lib/format';
import { colors, space } from '@/theme/tokens';

// Where the API sends the owner back after paying in Wompi (docs/arquitectura.md §6).
const PAYMENT_RETURN_URL = 'pawie://payment/result';
// While someone else has to act (the caregiver answers, Wompi confirms), ask again this often.
const POLL_MS = 5000;

/**
 * One booking, from the request to the visit: Esperando while the caregiver answers, Pagar
 * once it's accepted and Confirmada once it's paid. It updates by itself while it waits.
 */
export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const booking = useBookingsGet(id, {
    query: {
      refetchInterval: (query) =>
        ['REQUESTED', 'PENDING_PAYMENT'].includes(query.state.data?.status ?? '') && POLL_MS,
    },
  });

  // Mis visitas has to show the new state too.
  const [lastStatus, setLastStatus] = useState(booking.data?.status);
  if (booking.data && booking.data.status !== lastStatus) {
    setLastStatus(booking.data.status);
    void queryClient.invalidateQueries({ queryKey: getBookingsListQueryKey() });
  }

  if (!booking.data) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        {booking.isError ? (
          <View style={styles.padded}>
            <Banner tone="error" message={errorMessage(booking.error)} />
            <Button variant="secondary" label="Ver mis visitas" onPress={goToVisits} />
          </View>
        ) : (
          <ActivityIndicator color={colors.grapeDeep} />
        )}
      </SafeAreaView>
    );
  }

  const data = booking.data;
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {data.status === 'REQUESTED' ? (
          <Waiting booking={data} />
        ) : data.status === 'PENDING_PAYMENT' ? (
          <Pay booking={data} onPaid={() => booking.refetch()} />
        ) : data.status === 'CONFIRMED' || data.status === 'IN_PROGRESS' ? (
          <Confirmed booking={data} />
        ) : (
          <Closed booking={data} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function goToVisits() {
  router.dismissTo('/visitas');
}

function bookingSteps(booking: BookingResponse): string[] {
  return ['Solicitar', `${firstName(booking.caregiver.displayName)} responde`, 'Pagar'];
}

function petNames(booking: BookingResponse): string {
  return joinNames(booking.pets.map((pet) => pet.name));
}

/** "Lun 19 oct · 9:00–10:00", or "Noche del Lun 19 oct" for an overnight stay. */
function when(booking: BookingResponse): string {
  return booking.serviceCode === 'OVERNIGHT_STAY'
    ? `Noche del ${formatDay(booking.startsAt)}`
    : formatRange(booking.startsAt, booking.endsAt);
}

function Waiting({ booking }: { booking: BookingResponse }) {
  const name = firstName(booking.caregiver.displayName);
  const cancel = useCancel(booking.id);

  return (
    <>
      <StepBar current={2} steps={bookingSteps(booking)} />
      <View style={styles.hero} accessibilityLiveRegion="polite">
        <Nimbus pose="durmiendo" background="sky" />
        <Tag tone="info" label="Solicitud enviada" icon={<Icon name="clock" size={16} />} />
        <View style={styles.heroText}>
          <Text variant="title" style={styles.centered} accessibilityRole="header">
            Le avisamos a {name}
          </Text>
          <Text style={styles.centered}>
            {booking.responseDueAt
              ? `Responde ${formatDeadline(booking.responseDueAt)}. Esta pantalla cambia en cuanto acepte.`
              : 'Esta pantalla cambia en cuanto acepte.'}
          </Text>
        </View>
      </View>

      <Summary booking={booking}>
        <SummaryRow icon="credit-card" last>
          <Text style={styles.flex}>Total</Text>
          <Text>
            <Text variant="bodyStrong">{formatMoney(booking.price.totalCents)}</Text>
            <Text variant="caption" color="inkMuted">
              {' '}
              · aún no pagas
            </Text>
          </Text>
        </SummaryRow>
      </Summary>

      {cancel.isError && <Banner tone="error" message={errorMessage(cancel.error)} />}

      <View style={styles.footer}>
        <Text variant="caption" color="inkMuted" style={styles.centered}>
          Puedes salir de aquí: la encuentras en Mis visitas.
        </Text>
        <Button variant="secondary" label="Ver mis visitas" onPress={goToVisits} />
        <Button
          variant="danger"
          label="Cancelar solicitud"
          loading={cancel.isPending}
          onPress={() => confirmCancel(cancel.run)}
        />
      </View>
    </>
  );
}

function Pay({ booking, onPaid }: { booking: BookingResponse; onPaid: () => void }) {
  const name = firstName(booking.caregiver.displayName);
  const pay = usePaymentsStart();
  const cancel = useCancel(booking.id);
  const [returned, setReturned] = useState(false);
  const overnight = booking.serviceCode === 'OVERNIGHT_STAY';
  const level = booking.careLevel === 'SPECIAL' ? 'especial' : 'normal';
  const confirming = returned && booking.payment?.status === 'PENDING';

  const startPayment = () =>
    pay.mutate(
      { bookingId: booking.id },
      {
        onSuccess: async (payment) => {
          if (!payment.checkoutUrl) return;
          await WebBrowser.openAuthSessionAsync(payment.checkoutUrl, PAYMENT_RETURN_URL);
          // Wompi confirms with a webhook, not with the return: until then, this keeps asking.
          setReturned(true);
          onPaid();
        },
      },
    );

  return (
    <>
      <View style={styles.titleRow}>
        <IconButton
          icon="x"
          accessibilityLabel="Cerrar. Puedes pagar después desde Mis visitas"
          onPress={goToVisits}
        />
        <Text variant="title" accessibilityRole="header">
          {overnight ? 'Paga tu pernocta' : 'Paga tu visita'}
        </Text>
      </View>
      <StepBar current={bookingSteps(booking).length} steps={bookingSteps(booking)} />

      <Animated.View entering={FadeInDown.duration(350)} style={styles.accepted}>
        <Avatar name={booking.caregiver.displayName} photoUrl={booking.caregiver.photoUrl} />
        <View style={styles.flex}>
          <Text variant="bodyStrong">
            {name} aceptó cuidar a {petNames(booking)}
          </Text>
          <Text variant="caption">{when(booking)}</Text>
        </View>
      </Animated.View>

      {booking.paymentDueAt && (
        <Banner
          tone="warning"
          message={`Paga ${formatDeadline(booking.paymentDueAt)}. Si no, el horario se libera para otra familia.`}
        />
      )}

      <View style={styles.section}>
        <Text variant="heading" accessibilityRole="header">
          Detalle
        </Text>
        <Card style={styles.price}>
          {booking.slots.map((slot) => (
            <PriceLine
              key={slot.startsAt}
              label={`${overnight && slot.serviceCode === 'OVERNIGHT_STAY' ? 'Pernocta' : 'Visita'} ${level} · ${petNames(booking)}`}
              amount={formatMoney(slot.subtotalCents)}
            />
          ))}
          <PriceLine
            label={`Tarifa de servicio (${booking.price.serviceFeeBp / 100}%)`}
            amount={formatMoney(booking.price.serviceFeeCents)}
          />
          <View style={styles.total}>
            <Text variant="heading">Total</Text>
            <Text variant="heading">{formatMoney(booking.price.totalCents)}</Text>
          </View>
        </Card>
      </View>

      {confirming ? (
        <Banner
          tone="info"
          message="Estamos confirmando tu pago con Wompi. Tarda unos segundos; si no pagaste, puedes intentar de nuevo."
        />
      ) : booking.payment?.status === 'DECLINED' ? (
        <Banner tone="error" message="Wompi rechazó el pago. Intenta de nuevo con otra tarjeta." />
      ) : (
        <Banner
          tone="info"
          icon="lock"
          message="Pagas con tarjeta en Wompi, de Banco Agrícola. Al terminar, te traemos de vuelta aquí."
        />
      )}
      {pay.isError && <Banner tone="error" message={errorMessage(pay.error)} />}
      {cancel.isError && <Banner tone="error" message={errorMessage(cancel.error)} />}

      <View style={styles.footer}>
        <Button
          label={`Pagar ${formatMoney(booking.price.totalCents)}`}
          loading={pay.isPending}
          onPress={startPayment}
        />
        <Button
          variant="danger"
          label="Cancelar sin costo"
          loading={cancel.isPending}
          onPress={() => confirmCancel(cancel.run)}
        />
      </View>
    </>
  );
}

function Confirmed({ booking }: { booking: BookingResponse }) {
  const name = firstName(booking.caregiver.displayName);
  const pets = petNames(booking);
  const phone = booking.caregiver.phone;
  const tag = statusTag(booking);

  return (
    <>
      <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.hero}>
        <Nimbus pose="hola" background="sage" />
      </Animated.View>
      <Animated.View entering={FadeIn.delay(200).duration(400)} style={styles.hero}>
        <Tag tone={tag.tone} label={tag.label} icon={<Icon name="check" size={16} />} />
        <View style={styles.heroText}>
          <Text variant="title" style={styles.centered} accessibilityRole="header">
            {pets} {booking.pets.length > 1 ? 'están' : 'está'} en buenas manos
          </Text>
          <Text style={styles.centered}>
            {booking.serviceCode === 'OVERNIGHT_STAY'
              ? `${name} cuidará a ${pets} la noche del ${formatDay(booking.startsAt)}.`
              : `${name} visitará a ${pets} ${formatLongDayTime(booking.startsAt)}.`}
          </Text>
        </View>
      </Animated.View>

      <Summary booking={booking} certified>
        <SummaryRow icon="map-pin">
          <Text style={styles.flex}>{booking.address.street}</Text>
        </SummaryRow>
        <SummaryRow icon="credit-card" last>
          <Text style={styles.flex}>Pagaste</Text>
          <Text variant="bodyStrong">{formatMoney(booking.price.totalCents)}</Text>
        </SummaryRow>
      </Summary>

      <View style={styles.footer}>
        {phone ? (
          <>
            <Button
              label={`Llamar a ${name}`}
              icon={<Icon name="phone" color="card" />}
              onPress={() => Linking.openURL(`tel:${phone}`)}
            />
            <Button variant="secondary" label="Ver mis visitas" onPress={goToVisits} />
          </>
        ) : (
          <Button label="Ver mis visitas" onPress={goToVisits} />
        )}
      </View>
    </>
  );
}

function Closed({ booking }: { booking: BookingResponse }) {
  const tag = statusTag(booking);

  return (
    <>
      <View style={styles.titleRow}>
        <IconButton icon="x" accessibilityLabel="Cerrar" onPress={goToVisits} />
        <Text variant="title" accessibilityRole="header">
          Tu reserva
        </Text>
      </View>
      <Tag tone={tag.tone} label={tag.label} />
      <Summary booking={booking}>
        <SummaryRow icon="credit-card" last>
          <Text style={styles.flex}>Total</Text>
          <Text variant="bodyStrong">{formatMoney(booking.price.totalCents)}</Text>
        </SummaryRow>
      </Summary>
      <View style={styles.footer}>
        <Button label="Buscar cuidador" onPress={() => router.dismissTo('/')} />
        <Button variant="secondary" label="Ver mis visitas" onPress={goToVisits} />
      </View>
    </>
  );
}

/** The caregiver, the service and when, plus the rows each state adds. */
function Summary({
  booking,
  certified = false,
  children,
}: {
  booking: BookingResponse;
  certified?: boolean;
  children: ReactNode;
}) {
  return (
    <Card style={styles.summary}>
      <SummaryRow>
        <Avatar
          name={booking.caregiver.displayName}
          photoUrl={booking.caregiver.photoUrl}
          size={40}
        />
        <View style={styles.flex}>
          <Text variant="bodyStrong">{booking.caregiver.displayName}</Text>
          <Text variant="caption" color="inkMuted">
            {serviceName(booking.serviceCode)} · {petNames(booking)}
          </Text>
        </View>
        {certified && booking.careLevel === 'SPECIAL' && <Tag tone="special" label="Especial" />}
      </SummaryRow>
      <SummaryRow icon="calendar">
        <Text>{when(booking)}</Text>
      </SummaryRow>
      {children}
    </Card>
  );
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

function PriceLine({ label, amount }: { label: string; amount: string }) {
  return (
    <View style={styles.priceLine}>
      <Text style={styles.flex}>{label}</Text>
      <Text>{amount}</Text>
    </View>
  );
}

/** Cancelling can't be undone, so it asks first. */
function confirmCancel(run: () => void) {
  Alert.alert('¿Cancelar la reserva?', 'No te cobramos nada, y el horario queda libre.', [
    { text: 'No, seguir', style: 'cancel' },
    { text: 'Sí, cancelar', style: 'destructive', onPress: run },
  ]);
}

function useCancel(bookingId: string) {
  const queryClient = useQueryClient();
  const cancel = useBookingsCancel();
  return {
    ...cancel,
    run: () =>
      cancel.mutate(
        { bookingId, data: {} },
        {
          onSuccess: (booking) => {
            queryClient.setQueryData(getBookingsGetQueryKey(bookingId), booking);
            void queryClient.invalidateQueries({ queryKey: getBookingsListQueryKey() });
          },
        },
      ),
  };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  centered: { alignItems: 'center', justifyContent: 'center', textAlign: 'center' },
  padded: { alignSelf: 'stretch', gap: space[4], padding: space[4] },
  content: { flexGrow: 1, gap: space[6], padding: space[4], paddingTop: space[6] },
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  hero: { alignItems: 'center', gap: space[4] },
  heroText: { gap: space[2] },
  accepted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    borderRadius: 20,
    backgroundColor: colors.sage,
  },
  section: { gap: space[3] },
  summary: { paddingVertical: space[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3] },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  price: { gap: space[3] },
  priceLine: { flexDirection: 'row', gap: space[2] },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: space[3],
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  footer: { marginTop: 'auto', gap: space[2] },
});
