import type { CaregiverBookingResponse } from '@pawie/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { joinNames, serviceKind } from '@/lib/bookings';
import { caregiverStatusTag } from '@/lib/caregiver-bookings';
import { formatMoney } from '@/lib/format';
import { services } from '@/theme/services';
import { colors, radius } from '@/theme/tokens';

import { Icon } from './Icon';
import { Row } from './Row';
import { Text } from './Text';

export type CaregiverBookingRowProps = {
  booking: CaregiverBookingResponse;
  /** When it is: the whole date in a list of requests, only the hours in the agenda's days. */
  when: string;
  divider?: boolean;
};

/**
 * A booking in the caregiver's lists (CuiInicio and CuiAgenda): the service, the pets, when,
 * where, its state and what the caregiver gets, from the API (RN-RES-11). It opens the booking.
 */
export function CaregiverBookingRow({ booking, when, divider = false }: CaregiverBookingRowProps) {
  const { color, icon } = services[booking.serviceCode];
  const title = `${serviceKind(booking)} para ${joinNames(booking.pets.map(({ name }) => name))}`;
  const notes = [
    booking.careLevel === 'SPECIAL' && 'Especial',
    booking.pets.some(({ inHeat }) => inHeat) && 'En celo',
  ].filter(Boolean);
  const status = caregiverStatusTag(booking).label;
  const payout = formatMoney(booking.earnings.payoutCents);

  return (
    <Row
      divider={divider}
      onPress={() =>
        router.push({ pathname: '/cuidador/reservas/[id]', params: { id: booking.id } })
      }
      accessibilityLabel={`${title}. ${when}, ${booking.district.name}. ${notes.join(', ')}${notes.length ? '. ' : ''}${status}. Ganas ${payout}`}
    >
      <View style={[styles.service, { backgroundColor: colors[color] }]}>
        <Icon name={icon} />
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" color="inkMuted">
          {when}, {booking.district.name}
        </Text>
        {notes.length > 0 && <Text variant="caption">{notes.join(', ')}</Text>}
        <Text variant="caption" color={booking.status === 'REQUESTED' ? 'ink' : 'inkMuted'}>
          {status}
        </Text>
      </View>
      <Text variant="priceSmall">{payout}</Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  service: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  flex: { flex: 1, gap: 2 },
});
