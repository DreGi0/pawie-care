import {
  useCaregiversProfile,
  useCatalogGet,
  usePetsList,
  type CaregiverPrice,
  type ServiceCode,
} from '@pawie/api-client';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner } from '@/components/Banner';
import { BottomBar } from '@/components/BottomBar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Tag } from '@/components/Tag';
import { Text } from '@/components/Text';
import { errorMessage } from '@/lib/api';
import { firstName, joinNames, serviceName, serviceUnit } from '@/lib/bookings';
import { BADGE_NAMES, SKILL_NAMES, levelLabel } from '@/lib/caregivers';
import { formatDay, formatDayTime, formatMoney } from '@/lib/format';
import { useSearch, useSearchResults } from '@/lib/search';
import { colors, radius, space } from '@/theme/tokens';

const HEADER = 280;

// The mockup's gallery of 3 photos waits for the API, which has one photo per caregiver.
export default function CaregiverProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const profile = useCaregiversProfile(id);
  const catalog = useCatalogGet();
  const pets = usePetsList();
  const search = useSearch();
  const results = useSearchResults(search);

  if (!profile.data) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        {profile.isError ? (
          <View style={styles.error}>
            <Banner tone="error" message={errorMessage(profile.error)} />
            <Button variant="secondary" label="Volver" onPress={() => router.back()} />
          </View>
        ) : (
          <ActivityIndicator color={colors.grapeDeep} />
        )}
      </SafeAreaView>
    );
  }

  const caregiver = profile.data;
  const name = firstName(caregiver.displayName);
  // Available means it's in the results of the current search, with its price for that level.
  const match = results.data?.results.find((result) => result.id === caregiver.id);
  const price = match?.prices.find((p) => p.serviceCode === search?.serviceCode);
  const selectedPets = (pets.data ?? []).filter((pet) => search?.petIds.includes(pet.id));
  const petNames = joinNames(selectedPets.map((pet) => pet.name));
  const slot = results.data?.slots[0];
  const overnight = search?.serviceCode === 'OVERNIGHT_STAY';

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          {caregiver.photoUrl ? (
            <Image
              source={caregiver.photoUrl}
              contentFit="cover"
              style={StyleSheet.absoluteFill}
              accessibilityLabel={`Foto de ${name}`}
            />
          ) : (
            <Animated.View entering={FadeIn.duration(400)} style={styles.initials}>
              <Text variant="display">
                {caregiver.displayName
                  .split(' ')
                  .map((word) => word.charAt(0))
                  .join('')}
              </Text>
            </Animated.View>
          )}
        </View>

        <Animated.View entering={FadeInDown.duration(350)} style={styles.body}>
          <View style={styles.section}>
            <Text variant="title" accessibilityRole="header">
              {caregiver.displayName}
            </Text>
            <Tag tone="level" label={levelLabel(caregiver.level)} />
            <View style={styles.rating}>
              <Icon name="star" size={18} />
              <Text>
                <Text variant="bodyStrong">{caregiver.rating?.toFixed(1) ?? 'Nuevo'}</Text>
                <Text color="inkMuted">
                  {caregiver.rating !== null && ` (${caregiver.ratingCount})`} ·{' '}
                  {caregiver.completedBookingCount} servicios en Pawie
                </Text>
              </Text>
            </View>
          </View>

          {search && slot && match && (
            <View style={styles.available}>
              <Icon name="check" />
              <View style={styles.flex}>
                <Text variant="bodyStrong">Disponible para {petNames}</Text>
                <Text variant="caption">
                  {overnight
                    ? `Noche del ${formatDay(slot.startsAt)}`
                    : formatDayTime(slot.startsAt)}
                  {caregiver.instantBooking && ' · Acepta al instante'}
                </Text>
              </View>
            </View>
          )}
          {search && results.data && !match && (
            <Banner
              tone="warning"
              message={`${name} no está disponible para tu búsqueda. Prueba con otro día u hora.`}
            />
          )}

          {caregiver.badges.length > 0 && (
            <TagGroup label="Verificado por Pawie">
              {caregiver.badges.map((badge) => (
                <Tag
                  key={badge}
                  tone="success"
                  label={BADGE_NAMES[badge]}
                  icon={<Icon name="check" size={16} />}
                />
              ))}
            </TagGroup>
          )}
          {caregiver.certifications.length > 0 && (
            <TagGroup label="Certificaciones">
              {caregiver.certifications.map(({ code, name: certification }) =>
                code === 'SPECIAL_CARE' ? (
                  <Tag key={code} tone="certified" label={`⭐ ${certification}`} />
                ) : (
                  <Tag key={code} tone="info" label={certification} />
                ),
              )}
            </TagGroup>
          )}
          {caregiver.skills.length > 0 && (
            <TagGroup label={`Habilidades que declara ${name}`}>
              {caregiver.skills.map((skill) => (
                <Tag key={skill} tone="neutral" label={SKILL_NAMES[skill]} />
              ))}
            </TagGroup>
          )}

          {caregiver.bio && (
            <View style={styles.section}>
              <Text variant="heading" accessibilityRole="header">
                Sobre {name}
              </Text>
              <Text>{caregiver.bio}</Text>
              <View style={styles.districts}>
                <Icon name="map-pin" size={16} color="inkMuted" />
                <Text variant="caption" color="inkMuted" style={styles.flex}>
                  {joinNames(caregiver.districts.map((d) => d.name))}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text variant="heading" accessibilityRole="header">
              Precios
            </Text>
            <Card style={styles.prices}>
              {(['HOME_VISIT', 'OVERNIGHT_STAY'] as const).map((code, index) => (
                <PriceRow
                  key={code}
                  code={code}
                  prices={caregiver.prices}
                  detail={
                    code === 'HOME_VISIT'
                      ? visitLength(catalog.data?.bookingRules.homeVisitMinutes ?? 60)
                      : `De ${minuteLabel(catalog.data?.bookingRules.overnightStartMinute ?? 1140)} a ${minuteLabel(catalog.data?.bookingRules.overnightEndMinute ?? 480)}`
                  }
                  last={index === 1}
                />
              ))}
            </Card>
            <Text variant="caption" color="inkMuted">
              El precio es el mismo para todas las mascotas, también las Especiales. Cada mascota
              adicional suma 50%.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      <IconButton
        icon="chevron-left"
        accessibilityLabel="Volver a los resultados"
        onPress={() => router.back()}
        style={[styles.back, { top: insets.top + space[2] }]}
      />

      {search && price && (
        <BottomBar
          caption={`Precio ${serviceUnit(search.serviceCode)}`}
          amount={formatMoney(price.priceCents, { short: true })}
        >
          <Button
            label={overnight ? 'Reservar pernocta' : 'Reservar visita'}
            onPress={() => router.push({ pathname: '/reservar', params: { caregiverId: id } })}
          />
        </BottomBar>
      )}
    </View>
  );
}

function TagGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="heading" accessibilityRole="header">
        {label}
      </Text>
      <View style={styles.tags}>{children}</View>
    </View>
  );
}

/** 60 is "Hasta 1 hora". */
function visitLength(minutes: number): string {
  return minutes === 60 ? 'Hasta 1 hora' : `Hasta ${minutes} min`;
}

/** 1140 is "19:00". */
function minuteLabel(minute: number): string {
  return `${Math.floor(minute / 60)}:${String(minute % 60).padStart(2, '0')}`;
}

function PriceRow({
  code,
  prices,
  detail,
  last,
}: {
  code: ServiceCode;
  prices: CaregiverPrice[];
  detail: string;
  last: boolean;
}) {
  const price = prices.find((p) => p.serviceCode === code);

  return (
    <View style={[styles.priceRow, !last && styles.priceDivider]}>
      <View style={styles.flex}>
        <Text variant="bodyStrong">{serviceName(code)}</Text>
        <Text variant="caption" color="inkMuted">
          {detail}
        </Text>
      </View>
      <Text variant="bodyStrong" style={styles.priceCell}>
        {price ? formatMoney(price.priceCents, { short: true }) : '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  centered: { alignItems: 'center', justifyContent: 'center' },
  error: { alignSelf: 'stretch', gap: space[4], padding: space[4] },
  scroll: { paddingBottom: space[8] },
  flex: { flex: 1 },
  header: {
    height: HEADER,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.grape,
  },
  initials: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 64,
    backgroundColor: colors.card,
  },
  back: { position: 'absolute', left: space[4] },
  body: {
    gap: space[6],
    marginTop: -space[6],
    paddingTop: space[6],
    paddingHorizontal: space[4],
    backgroundColor: colors.cream,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  section: { gap: space[2] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  available: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderRadius: radius.md,
    backgroundColor: colors.sage,
  },
  districts: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prices: { paddingVertical: space[1] },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[3],
  },
  priceDivider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  priceCell: { width: 72, textAlign: 'right' },
});
