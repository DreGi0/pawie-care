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

/** The breakdown of Reservar and Pagar. RN-PRE-09: the waived fee is crossed out at $0.00. */
export function PriceCard({ lines, price }: PriceCardProps) {
  const { firstServiceFeeWaived, serviceFeeBp, serviceFeeCents, totalCents } = price;

  return (
    <Card style={styles.card}>
      {lines.map(({ label, amountCents }, index) => (
        <Line key={index} label={label} amount={formatMoney(amountCents)} />
      ))}
      {firstServiceFeeWaived ? (
        <View style={styles.waived}>
          <Line label="Tarifa de servicio" amount={formatMoney(serviceFeeCents)} struck />
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

function Line({
  label,
  amount,
  struck = false,
}: {
  label: string;
  amount: string;
  struck?: boolean;
}) {
  const style = struck ? styles.struck : undefined;
  return (
    <View style={styles.line}>
      <Text color={struck ? 'inkMuted' : 'ink'} style={[styles.label, style]}>
        {label}
      </Text>
      <Text color={struck ? 'inkMuted' : 'ink'} style={style}>
        {amount}
      </Text>
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
