import { useCaregiverBookingsEarnings, type PendingEarning } from '@pawie/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Row } from '@/components/Row';
import { Text } from '@/components/Text';
import { errorMessage } from '@/lib/api';
import { joinNames, serviceShortName } from '@/lib/bookings';
import { formatDay, formatMoney, formatMonth } from '@/lib/format';
import { services } from '@/theme/services';
import { colors, gutter, radius, space } from '@/theme/tokens';

// CuiGanancias (RN-PAG-10): the month's total, what is to be paid and what was paid, all from
// the API. Payouts to the caregiver come in stage 10, so "Pagado" stays at $0.00 until then.
export default function EarningsScreen() {
  const earnings = useCaregiverBookingsEarnings();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await earnings.refetch();
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
          Ganancias
        </Text>

        {earnings.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : earnings.isError ? (
          <>
            <Banner tone="error" message={errorMessage(earnings.error)} />
            <Button label="Reintentar" onPress={() => earnings.refetch()} />
          </>
        ) : (
          <>
            <View
              accessible
              accessibilityLabel={`${formatMonth(earnings.data.month)}: ${formatMoney(earnings.data.monthTotalCents)}`}
              style={styles.month}
            >
              <Text variant="caption" color="inkMuted">
                {formatMonth(earnings.data.month)}
              </Text>
              <Text variant="display">{formatMoney(earnings.data.monthTotalCents)}</Text>
              <Text variant="caption" color="inkMuted">
                Lo que ganas con los servicios de este mes, cobrados o por cobrar.
              </Text>
            </View>

            <View style={styles.tiles}>
              <Tile label="Por cobrar" cents={earnings.data.pendingCents} />
              <Tile label="Pagado" cents={earnings.data.paidCents} />
            </View>
            <Text variant="caption" color="inkMuted">
              Te pagamos cada servicio cuando termina y pasa el plazo para reclamos. En la demo, el
              pago es simulado.
            </Text>

            <View style={styles.section}>
              <Text variant="heading" accessibilityRole="header">
                Por cobrar
              </Text>
              {earnings.data.pending.length === 0 ? (
                <Text color="inkMuted">
                  Cuando el dueño pague una reserva que aceptaste, aparece aquí.
                </Text>
              ) : (
                <View>
                  {earnings.data.pending.map((item, index) => (
                    <PendingRow key={item.bookingId} item={item} divider={index > 0} />
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({ label, cents }: { label: string; cents: number }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${formatMoney(cents)}`} style={styles.tile}>
      <Text variant="caption" color="inkMuted">
        {label}
      </Text>
      <Text variant="priceSmall">{formatMoney(cents)}</Text>
    </View>
  );
}

function PendingRow({ item, divider }: { item: PendingEarning; divider: boolean }) {
  const { color, icon } = services[item.serviceCode];
  const title = `${serviceShortName(item.serviceCode)} para ${joinNames(item.petNames)}`;
  return (
    <Row
      divider={divider}
      onPress={() =>
        router.push({ pathname: '/cuidador/reservas/[id]', params: { id: item.bookingId } })
      }
      accessibilityLabel={`${title}, ${formatDay(item.startsAt)}. ${formatMoney(item.payoutCents)}`}
    >
      <View style={[styles.service, { backgroundColor: colors[color] }]}>
        <Icon name={icon} />
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" color="inkMuted">
          {formatDay(item.startsAt)}
        </Text>
      </View>
      <Text variant="priceSmall">{formatMoney(item.payoutCents)}</Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    gap: space[4],
    paddingHorizontal: gutter,
    paddingTop: space[2],
    paddingBottom: space[8],
  },
  loading: { marginTop: space[8] },
  month: {
    gap: space[1],
    padding: space[5],
    borderRadius: radius.lg,
    backgroundColor: colors.tint,
  },
  tiles: { flexDirection: 'row', gap: space[3] },
  tile: {
    flex: 1,
    gap: space[1],
    padding: space[4],
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  section: { gap: space[1], marginTop: space[2] },
  service: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  flex: { flex: 1, gap: 2 },
});
