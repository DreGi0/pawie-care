import type { BookingPrice } from '@pawie/api-client';
import { StyleSheet, View } from 'react-native';

import { formatMoney } from '@/lib/format';
import { colors, space } from '@/theme/tokens';

import { Card } from './Card';
import { Tag } from './Tag';
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
        <View style={styles.waived}>
          <View style={styles.line}>
            <Text style={styles.label}>Tarifa de servicio</Text>
            {waivedServiceFeeCents > 0 && (
              <Text color="inkMuted" style={styles.struck}>
                {formatMoney(waivedServiceFeeCents)}
              </Text>
            )}
            <Text>{formatMoney(serviceFeeCents)}</Text>
          </View>
          <Tag tone="success" label="Primer servicio" />
        </View>
      ) : (
        <Line
          label={`Tarifa de servicio (${serviceFeeBp / 100}%)`}
          amount={formatMoney(serviceFeeCents)}
        />
      )}
      <View style={styles.total}>
        <Text variant="heading">Total</Text>
        <Text variant="heading">{formatMoney(totalCents)}</Text>
      </View>
    </Card>
  );
}

function Line({ label, amount }: { label: string; amount: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.label}>{label}</Text>
      <Text>{amount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[3] },
  line: { flexDirection: 'row', gap: space[2] },
  label: { flex: 1 },
  struck: { textDecorationLine: 'line-through' },
  waived: { gap: space[2] },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: space[3],
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
