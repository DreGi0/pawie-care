import { useBookingsList, usePetsList, type BookingResponse } from '@pawie/api-client';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { css, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { Nimbus } from '@/components/Nimbus';
import { Tag } from '@/components/Tag';
import { Text } from '@/components/Text';
import { Touchable } from '@/components/Touchable';
import { isUpcoming, joinNames, statusTag, type StatusTag } from '@/lib/bookings';
import { formatDayTime, formatMoney } from '@/lib/format';
import { colors, shadow, space } from '@/theme/tokens';

type Filter = 'upcoming' | 'past';

const TAG_ICONS: Record<StatusTag['tone'], IconName> = {
  info: 'rotate-cw',
  warning: 'clock',
  success: 'check',
  error: 'x',
};

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
            colors={[colors.grapeDeep]}
            tintColor={colors.grapeDeep}
          />
        }
      >
        <Text variant="title" accessibilityRole="header">
          Mis visitas
        </Text>
        <Segmented value={filter} onChange={setFilter} />

        {bookings.isPending ? (
          <ActivityIndicator color={colors.grapeDeep} style={styles.loading} />
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
          <View key={filter} style={styles.list}>
            {shown.map((booking, index) => (
              <Animated.View key={booking.id} entering={FadeInDown.delay(index * 60).duration(300)}>
                <VisitCard booking={booking} primary={booking.id === mostUrgent} />
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
              <Text variant="label" color={selected ? 'ink' : 'inkMuted'}>
                {option.label}
              </Text>
            </Animated.View>
          </Touchable>
        );
      })}
    </View>
  );
}

function VisitCard({ booking, primary }: { booking: BookingResponse; primary: boolean }) {
  const tag = statusTag(booking);
  const name = booking.caregiver.displayName;
  const pets = joinNames(booking.pets.map((pet) => pet.name));
  const open = () => router.push(`/reservas/${booking.id}`);
  const toPay = booking.status === 'PENDING_PAYMENT';

  // With "Pagar", the button opens the booking: a card that is also a button would nest them.
  return (
    <Card
      style={styles.card}
      onPress={toPay ? undefined : open}
      accessibilityLabel={toPay ? undefined : `${pets} con ${name}, ${tag.label}`}
    >
      <Tag tone={tag.tone} label={tag.label} icon={<Icon name={TAG_ICONS[tag.tone]} size={14} />} />
      <View style={styles.row}>
        <Avatar name={name} photoUrl={booking.caregiver.photoUrl} />
        <View style={styles.flex}>
          <Text variant="bodyStrong">
            {pets} con {name}
          </Text>
          <Text variant="caption" color="inkMuted">
            {formatDayTime(booking.startsAt)} · {kind(booking)}
          </Text>
        </View>
        {!toPay && <Icon name="chevron-right" color="inkMuted" />}
      </View>
      {toPay && (
        <Button
          variant={primary ? 'primary' : 'secondary'}
          label={`Pagar ${formatMoney(booking.price.totalCents)}`}
          onPress={open}
        />
      )}
    </Card>
  );
}

/** "Visita a domicilio", "Visita especial", "Pernocta" or "Pernocta especial". */
function kind(booking: BookingResponse): string {
  const special = booking.careLevel === 'SPECIAL';
  if (booking.serviceCode === 'OVERNIGHT_STAY') return special ? 'Pernocta especial' : 'Pernocta';
  return special ? 'Visita especial' : 'Visita a domicilio';
}

function NoVisits({ filter, petName }: { filter: Filter; petName?: string }) {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.empty}>
      <Nimbus pose="durmiendo" background="sky" size={128} />
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
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { flexGrow: 1, gap: space[4], padding: space[4], paddingTop: space[6] },
  loading: { marginTop: space[8] },
  flex: { flex: 1 },
  centered: { textAlign: 'center' },
  segmented: {
    flexDirection: 'row',
    gap: space[1],
    padding: space[1],
    borderRadius: (SEGMENT + space[2]) / 2,
    backgroundColor: colors.card,
    boxShadow: shadow.soft,
  },
  segment: { flex: 1 },
  segmentFill: {
    height: SEGMENT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SEGMENT / 2,
  },
  segmentSelected: { backgroundColor: colors.grape },
  list: { gap: space[3] },
  card: { gap: space[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  empty: { flexGrow: 1, justifyContent: 'center', gap: space[4] },
  emptyText: { gap: space[1] },
});
