import type { BookingPrice } from '@pawie/api-client';
import { StyleSheet, View } from 'react-native';

import { formatMoney } from '@/lib/format';
import { borderWidth, colors, space } from '@/theme/tokens';

import { Card } from './Card';
import { Text } from './Text';

export type PriceCardProps = {
  /** What the caregiver charges, one line per visit or night. */
  lines: { label: string; amountCents: number }[];
  /** The API's amounts, from the quote or the booking. The app doesn't calculate any. */
  price: BookingPrice;
};

/** The breakdown of Reservar and Pagar. RN-PRE-09: the fee it would have cost, crossed out, and $0.00. */
export function PriceCard({ lines, price }: PriceCardProps) {
  const {
    firstServiceFeeWaived,
    waivedServiceFeeCents,
    serviceFeeBp,
    serviceFeeCents,
    totalCents,
  } = price;

  return (
    <Card style={styles.card}>
      {lines.map(({ label, amountCents }, index) => (
        <Line key={index} label={label} amount={formatMoney(amountCents)} />
      ))}
      {firstServiceFeeWaived ? (
        <View>
          <View style={styles.line}>
            <Text style={styles.label}>Tarifa de servicio</Text>
            {waivedServiceFeeCents > 0 && (
              <Text color="inkMuted" style={styles.struck}>
                {formatMoney(waivedServiceFeeCents)}
              </Text>
            )}
            <Text variant="bodyStrong">{formatMoney(serviceFeeCents)}</Text>
          </View>
          <Text variant="caption" color="inkMuted">
            Sin tarifa: es tu primer servicio
          </Text>
        </View>
      ) : (
        <Line
          label={`Tarifa de servicio (${serviceFeeBp / 100}%)`}
          amount={formatMoney(serviceFeeCents)}
        />
      )}
      <View style={styles.total}>
        <Text variant="heading" style={styles.label}>
          Total
        </Text>
        <Text variant="priceSmall">{formatMoney(totalCents)}</Text>
      </View>
    </Card>
  );
}

function Line({ label, amount }: { label: string; amount: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.label}>{label}</Text>
      <Text variant="bodyStrong">{amount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[3] },
  line: { flexDirection: 'row', gap: space[2] },
  label: { flex: 1 },
  struck: { textDecorationLine: 'line-through' },
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: space[3],
    borderTopWidth: borderWidth.hairline,
    borderTopColor: colors.line,
  },
});
