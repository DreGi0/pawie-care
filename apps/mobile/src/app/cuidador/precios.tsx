import {
  getCaregiverMeGetQueryKey,
  getCaregiverMePricesQueryKey,
  useCaregiverMePrices,
  useCaregiverMeQuote,
  useCaregiverMeUpdate,
  type CaregiverPricesResponse,
  type CaregiverServicePriceResponse,
  type ServiceCode,
} from '@pawie/api-client';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Checkbox } from '@/components/Checkbox';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Text } from '@/components/Text';
import { errorMessage, queryClient } from '@/lib/api';
import { serviceName, serviceUnit } from '@/lib/bookings';
import { LEVEL_NAMES } from '@/lib/caregivers';
import { formatMoney } from '@/lib/format';
import { services } from '@/theme/services';
import { colors, gutter, radius, space } from '@/theme/tokens';

/** What −/+ moves the price by. */
const STEP_CENTS = 50;
/** How long after the last −/+ the app asks the API what the caregiver would get. */
const QUOTE_DEBOUNCE_MS = 400;

/** "tu visita sugerida", for the next level's line (RN-CUI-17). */
const SUGGESTED: Record<ServiceCode, string> = {
  HOME_VISIT: 'tu visita sugerida',
  OVERNIGHT_STAY: 'tu pernocta sugerida',
};

/** Whether the caregiver offers the service, and their price. Null is the suggested one. */
type Draft = Record<ServiceCode, { offered: boolean; priceCents: number | null }>;

const money = (cents: number) => formatMoney(cents, { short: true });

// CuiPrecios (RN-CUI-17, RN-PRE-01, RN-PRE-04): the calculator. The ranges, the suggested prices
// and what the caregiver gets all come from the API; the app never computes them.
export default function PricesScreen() {
  const prices = useCaregiverMePrices();

  return (
    <SafeAreaView style={styles.screen}>
      {prices.data ? (
        <PricesForm prices={prices.data} />
      ) : (
        <View style={styles.content}>
          <IconButton
            icon="chevron-left"
            accessibilityLabel="Volver"
            onPress={() => router.back()}
          />
          {prices.isError ? (
            <Banner tone="error" message={errorMessage(prices.error)} />
          ) : (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

function PricesForm({ prices }: { prices: CaregiverPricesResponse }) {
  const update = useCaregiverMeUpdate();
  const [draft, setDraft] = useState<Draft>(
    () =>
      Object.fromEntries(
        prices.prices.map(({ serviceCode, offered, caregiverPriceCents }) => [
          serviceCode,
          { offered, priceCents: caregiverPriceCents },
        ]),
      ) as Draft,
  );

  const save = () =>
    update.mutate(
      {
        data: {
          prices: prices.prices
            .filter(({ serviceCode }) => draft[serviceCode].offered)
            .map(({ serviceCode }) => ({ serviceCode, priceCents: draft[serviceCode].priceCents })),
        },
      },
      {
        onSuccess: (saved) => {
          queryClient.setQueryData(getCaregiverMeGetQueryKey(), saved);
          void queryClient.invalidateQueries({ queryKey: getCaregiverMePricesQueryKey() });
          router.back();
        },
      },
    );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <IconButton icon="chevron-left" accessibilityLabel="Volver" onPress={() => router.back()} />
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          Tus precios
        </Text>
        <Text color="inkMuted">
          Tu nivel es {LEVEL_NAMES[prices.level]}. Pones tu precio por una mascota dentro del rango
          de tu nivel; si no lo cambias, cobras el sugerido.
        </Text>
      </View>

      {prices.prices.map((price) => (
        <ServicePrice
          key={price.serviceCode}
          price={price}
          level={prices.level}
          value={draft[price.serviceCode]}
          onChange={(value) => setDraft({ ...draft, [price.serviceCode]: value })}
        />
      ))}

      {update.isError && <Banner tone="error" message={errorMessage(update.error)} />}
      <Button label="Guardar precios" loading={update.isPending} onPress={save} />
    </ScrollView>
  );
}

function ServicePrice({
  price,
  level,
  value,
  onChange,
}: {
  price: CaregiverServicePriceResponse;
  level: CaregiverPricesResponse['level'];
  value: Draft[ServiceCode];
  onChange: (value: Draft[ServiceCode]) => void;
}) {
  const { serviceCode, range, nextLevel } = price;
  const { color, icon } = services[serviceCode];
  const priceCents = value.priceCents ?? range.suggestedCents;
  const payoutCents = usePayout(price, priceCents);
  const unit = serviceUnit(serviceCode);
  const step = (cents: number) =>
    onChange({ ...value, priceCents: Math.min(Math.max(cents, range.minCents), range.maxCents) });

  return (
    <Card style={styles.card}>
      <View style={styles.service}>
        <View style={[styles.swatch, { backgroundColor: colors[color] }]}>
          <Icon name={icon} />
        </View>
        <Text variant="subheading" style={styles.flex}>
          {serviceName(serviceCode)}
        </Text>
      </View>
      <Checkbox
        label={`Ofrezco ${serviceCode === 'OVERNIGHT_STAY' ? 'pernoctas' : 'visitas'}`}
        checked={value.offered}
        onChange={(offered) => onChange({ ...value, offered })}
      />

      {value.offered ? (
        <>
          <View style={styles.stepper}>
            <IconButton
              icon="minus"
              accessibilityLabel={`Bajar ${money(STEP_CENTS)}`}
              disabled={priceCents <= range.minCents}
              onPress={() => step(priceCents - STEP_CENTS)}
            />
            <View
              style={styles.amount}
              accessible
              accessibilityLiveRegion="polite"
              accessibilityLabel={`${formatMoney(priceCents)} ${unit}`}
            >
              <Text variant="price">{formatMoney(priceCents)}</Text>
              <Text variant="footnote" color="inkMuted">
                {unit}
              </Text>
            </View>
            <IconButton
              icon="plus"
              accessibilityLabel={`Subir ${money(STEP_CENTS)}`}
              disabled={priceCents >= range.maxCents}
              onPress={() => step(priceCents + STEP_CENTS)}
            />
          </View>
          <Text variant="caption" color="inkMuted" style={styles.centered}>
            En {LEVEL_NAMES[level]} va de {money(range.minCents)} a {money(range.maxCents)}, y el
            sugerido es {money(range.suggestedCents)}.
          </Text>
          {value.priceCents !== null && value.priceCents !== range.suggestedCents && (
            <View style={styles.suggested}>
              <Chip
                label={`Usar el sugerido, ${money(range.suggestedCents)}`}
                selected={false}
                onPress={() => onChange({ ...value, priceCents: null })}
              />
            </View>
          )}

          {/* RN-PRE-04: the amount the API returns, with the commission in force. */}
          <View style={styles.payout} accessible accessibilityLiveRegion="polite">
            <Text>Recibes</Text>
            {payoutCents === null ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text variant="priceSmall">{formatMoney(payoutCents)}</Text>
            )}
            <Text>{unit}</Text>
          </View>

          {nextLevel && (
            <Text>
              En {LEVEL_NAMES[nextLevel.level]}, {SUGGESTED[serviceCode]} sube de{' '}
              {money(range.suggestedCents)} a{' '}
              <Text variant="bodyStrong">{money(nextLevel.suggestedCents)}</Text>.
            </Text>
          )}
        </>
      ) : (
        <Text variant="caption" color="inkMuted">
          No apareces en las búsquedas de {serviceCode === 'OVERNIGHT_STAY' ? 'pernocta' : 'visita'}
          .
        </Text>
      )}
    </Card>
  );
}

/**
 * What the caregiver gets with `priceCents` (RN-PRE-04): the saved amount for the saved price,
 * or the API's quote, asked QUOTE_DEBOUNCE_MS after the last −/+. Null while it's on its way.
 */
function usePayout(price: CaregiverServicePriceResponse, priceCents: number): number | null {
  const quote = useCaregiverMeQuote();
  const [quoted, setQuoted] = useState<{ priceCents: number; payoutCents: number } | null>(null);
  const saved = priceCents === price.priceCents;
  const { serviceCode } = price;
  const { mutate } = quote;

  useEffect(() => {
    if (saved) return;
    const timer = setTimeout(
      () => mutate({ data: { serviceCode, priceCents } }, { onSuccess: setQuoted }),
      QUOTE_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [saved, serviceCode, priceCents, mutate]);

  if (saved) return price.payoutCents;
  return quoted?.priceCents === priceCents ? quoted.payoutCents : null;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    gap: space[6],
    paddingHorizontal: gutter,
    paddingTop: space[1],
    paddingBottom: space[8],
  },
  loading: { marginTop: space[8] },
  header: { gap: space[1] },
  flex: { flex: 1 },
  centered: { textAlign: 'center' },
  card: { gap: space[3] },
  service: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  swatch: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space[1],
  },
  amount: { alignItems: 'center' },
  suggested: { alignItems: 'center' },
  payout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingVertical: space[3],
    borderRadius: radius.md,
    backgroundColor: colors.tint,
  },
});
