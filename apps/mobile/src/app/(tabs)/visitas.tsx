import { useBookingsList, usePetsList, type BookingResponse } from '@pawie/api-client';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { css, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { CaregiverPhoto } from '@/components/CaregiverPhoto';
import { Icon } from '@/components/Icon';
import { Nimbus } from '@/components/Nimbus';
import { Row } from '@/components/Row';
import { Status } from '@/components/Status';
import { Tag } from '@/components/Tag';
import { Text } from '@/components/Text';
import { Touchable } from '@/components/Touchable';
import { firstName, isUpcoming, joinNames, statusTag } from '@/lib/bookings';
import { formatDayTime, formatMoney } from '@/lib/format';
import { borderWidth, colors, gutter, space } from '@/theme/tokens';

type Filter = 'upcoming' | 'past';

export default function VisitsScreen() {
  const bookings = useBookingsList();
  const pets = usePetsList();
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [refreshing, setRefreshing] = useState(false);

  // A booking changes while the owner is elsewhere: the caregiver accepts, Wompi confirms.
  const { refetch } = bookings;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await bookings.refetch();
    setRefreshing(false);
  };

  const upcoming = (bookings.data ?? [])
    .filter((booking) => isUpcoming(booking.status))
    // The API lists the most recent first; what comes next goes first here.
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = (bookings.data ?? []).filter((booking) => !isUpcoming(booking.status));
  const shown = filter === 'upcoming' ? upcoming : past;
  // Only the payment that expires first gets the primary button.
  const mostUrgent = upcoming
    .filter((booking) => booking.status === 'PENDING_PAYMENT' && booking.paymentDueAt)
    .sort((a, b) => a.paymentDueAt!.localeCompare(b.paymentDueAt!))[0]?.id;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <Text variant="title" accessibilityRole="header">
          Mis visitas
        </Text>
        <Segmented value={filter} onChange={setFilter} />

        {bookings.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : bookings.isError ? (
          <>
            <Banner
              tone="error"
              message="No pudimos cargar tus visitas. Revisa tu conexión e intenta de nuevo."
            />
            <Button label="Reintentar" onPress={refresh} />
          </>
        ) : shown.length === 0 ? (
          <NoVisits filter={filter} petName={pets.data?.[0]?.name} />
        ) : (
          // The key replays the entrance when switching between upcoming and past.
          <View key={filter}>
            {shown.map((booking, index) => (
              <Animated.View key={booking.id} entering={FadeInDown.delay(index * 60).duration(300)}>
                <VisitRow
                  booking={booking}
                  primary={booking.id === mostUrgent}
                  divider={index > 0}
                />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Segmented({ value, onChange }: { value: Filter; onChange: (value: Filter) => void }) {
  const options: { value: Filter; label: string }[] = [
    { value: 'upcoming', label: 'Próximas' },
    { value: 'past', label: 'Pasadas' },
  ];

  return (
    <View accessibilityRole="tablist" style={styles.segmented}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Touchable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            pressedScale={0.97}
            style={styles.segment}
          >
            <Animated.View
              style={[styles.segmentFill, selected && styles.segmentSelected, transitions.segment]}
            >
              <Text variant="label" color={selected ? 'primary' : 'inkMuted'}>
                {option.label}
              </Text>
            </Animated.View>
          </Touchable>
        );
      })}
    </View>
  );
}

function VisitRow({
  booking,
  primary,
  divider,
}: {
  booking: BookingResponse;
  primary: boolean;
  divider: boolean;
}) {
  const status = statusTag(booking);
  const name = firstName(booking.caregiver.displayName);
  const pets = joinNames(booking.pets.map((pet) => pet.name));
  const open = () => router.push(`/reservas/${booking.id}`);
  const toPay = booking.status === 'PENDING_PAYMENT';

  // With "Pagar", the button opens the booking: a row that is also a button would nest them.
  return (
    <Row
      divider={divider}
      onPress={toPay ? undefined : open}
      accessibilityLabel={toPay ? undefined : `${pets} con ${name}, ${status.label}`}
      style={styles.visit}
    >
      <CaregiverPhoto name={booking.caregiver.displayName} photoUrl={booking.caregiver.photoUrl} />
      <View style={styles.visitText}>
        <Text variant="subheading">
          {pets} con {name}
        </Text>
        <View style={styles.when}>
          <Tag kind="service" service={booking.serviceCode} size="sm" />
          <Text variant="caption" color="inkMuted" style={styles.flex}>
            {formatDayTime(booking.startsAt)}
            {booking.careLevel === 'SPECIAL' && ', cuidado especial'}
          </Text>
        </View>
        <Status {...status} />
        {toPay && (
          <Button
            variant={primary ? 'primary' : 'secondary'}
            label={`Pagar ${formatMoney(booking.price.totalCents)}`}
            onPress={open}
            style={styles.pay}
          />
        )}
      </View>
      {!toPay && <Icon name="chevron-right" color="inkMuted" />}
    </Row>
  );
}

function NoVisits({ filter, petName }: { filter: Filter; petName?: string }) {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.empty}>
      <Nimbus pose="durmiendo" background="tint" size={128} />
      <View style={styles.emptyText}>
        <Text variant="heading" style={styles.centered}>
          {filter === 'upcoming' ? 'Aún no tienes visitas' : 'Aún no tienes visitas pasadas'}
        </Text>
        <Text color="inkMuted" style={styles.centered}>
          {petName ? `¿Buscamos un cuidador para ${petName}?` : '¿Buscamos un cuidador?'}
        </Text>
      </View>
      <Button label="Buscar cuidador" onPress={() => router.navigate('/')} />
    </Animated.View>
  );
}

const transitions = css.create({
  segment: { transitionProperty: 'backgroundColor', transitionDuration: 200 },
});

const SEGMENT = 44;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    gap: space[4],
    paddingHorizontal: gutter,
    paddingTop: space[2],
    paddingBottom: space[6],
  },
  loading: { marginTop: space[8] },
  flex: { flex: 1 },
  centered: { textAlign: 'center' },
  segmented: {
    flexDirection: 'row',
    gap: space[1],
    padding: space[1],
    borderRadius: (SEGMENT + space[2]) / 2,
    borderWidth: borderWidth.hairline,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  segment: { flex: 1 },
  segmentFill: {
    height: SEGMENT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SEGMENT / 2,
  },
  segmentSelected: { backgroundColor: colors.tint },
  visit: { alignItems: 'flex-start' },
  visitText: { flex: 1, gap: 6 },
  when: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  pay: { alignSelf: 'stretch', marginTop: space[1] },
  empty: { flexGrow: 1, justifyContent: 'center', gap: space[4] },
  emptyText: { gap: space[1] },
});
