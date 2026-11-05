import { useCaregiverBookingsList, type CaregiverBookingResponse } from '@pawie/api-client';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { CaregiverBookingRow } from '@/components/CaregiverBookingRow';
import { Text } from '@/components/Text';
import { errorMessage } from '@/lib/api';
import { AGENDA } from '@/lib/caregiver-bookings';
import { formatLongDay, formatTime, localDate, upcomingDays } from '@/lib/format';
import { colors, gutter, space } from '@/theme/tokens';

// CuiAgenda: the services ahead, by day in San Salvador. It has the accepted requests that wait
// for the owner's payment too, so the caregiver sees that time as taken; one the owner doesn't
// pay in time expires and leaves the agenda. "Agregar al calendario" comes in stage 11.
export default function AgendaScreen() {
  const agenda = useCaregiverBookingsList(AGENDA);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await agenda.refetch();
    setRefreshing(false);
  };

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
          Agenda
        </Text>

        {agenda.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : agenda.isError ? (
          <>
            <Banner tone="error" message={errorMessage(agenda.error)} />
            <Button label="Reintentar" onPress={() => agenda.refetch()} />
          </>
        ) : agenda.data.length === 0 ? (
          <Text color="inkMuted">
            No tienes servicios próximos. Las solicitudes que aceptes aparecen aquí.
          </Text>
        ) : (
          byDay(agenda.data).map(([day, bookings]) => (
            <View key={day} style={styles.day}>
              <Text variant="heading" accessibilityRole="header">
                {dayTitle(day, bookings[0].startsAt)}
              </Text>
              <View>
                {bookings.map((booking, index) => (
                  <CaregiverBookingRow
                    key={booking.id}
                    booking={booking}
                    when={`De ${formatTime(booking.startsAt)} a ${formatTime(booking.endsAt)}`}
                    divider={index > 0}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** The bookings by the day they start in San Salvador, in order. */
function byDay(bookings: CaregiverBookingResponse[]): [string, CaregiverBookingResponse[]][] {
  const days = new Map<string, CaregiverBookingResponse[]>();
  for (const booking of [...bookings].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const day = localDate(booking.startsAt);
    days.set(day, [...(days.get(day) ?? []), booking]);
  }
  return [...days.entries()];
}

/** "Hoy", "Mañana" or "Jueves 12 de noviembre". */
function dayTitle(day: string, startsAt: string): string {
  const [today, tomorrow] = upcomingDays(2);
  if (day === today) return 'Hoy';
  if (day === tomorrow) return 'Mañana';
  return formatLongDay(startsAt);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    gap: space[6],
    paddingHorizontal: gutter,
    paddingTop: space[2],
    paddingBottom: space[8],
  },
  loading: { marginTop: space[8] },
  day: { gap: space[1] },
});
