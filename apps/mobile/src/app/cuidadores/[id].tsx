import {
  useCaregiversProfile,
  useCatalogGet,
  usePetsList,
  type CaregiverBadge,
  type CaregiverPrice,
  type CaregiverProfileResponse,
  type ServiceCode,
} from '@pawie/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from '@/components/Banner';
import { BottomBar } from '@/components/BottomBar';
import { Button } from '@/components/Button';
import { CaregiverPhoto } from '@/components/CaregiverPhoto';
import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { LevelTag } from '@/components/LevelTag';
import { Row } from '@/components/Row';
import { Tag } from '@/components/Tag';
import { Text } from '@/components/Text';
import { errorMessage } from '@/lib/api';
import { firstName, joinNames, serviceName, serviceShortName, serviceUnit } from '@/lib/bookings';
import { BADGE_NAMES, SKILL_NAMES } from '@/lib/caregivers';
import { formatDay, formatDayTime, formatMoney } from '@/lib/format';
import { useSearch, useSearchResults } from '@/lib/search';
import { SERVICE_ORDER, services } from '@/theme/services';
import { colors, gutter, radius, space, typography } from '@/theme/tokens';

const BADGE_ICONS: Record<CaregiverBadge, IconName> = {
  IDENTITY_VERIFIED: 'check',
  BACKGROUND_CHECKED: 'check',
  VET_STUDENT: 'graduation-cap',
};

// The mockup's gallery of 3 photos waits for the API, which has one photo per caregiver.
export default function CaregiverProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
          <ActivityIndicator color={colors.primary} />
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
  const rules = catalog.data?.bookingRules;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <IconButton
          icon="chevron-left"
          accessibilityLabel="Volver a los resultados"
          onPress={() => router.back()}
        />

        <Animated.View entering={FadeIn.duration(400)} style={styles.hero}>
          <CaregiverPhoto name={caregiver.displayName} photoUrl={caregiver.photoUrl} width={186} />
          <View style={styles.collar}>
            <LevelTag level={caregiver.level} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(350)} style={styles.body}>
          <View style={styles.identity}>
            <Text variant="display" accessibilityRole="header">
              {caregiver.displayName}
            </Text>
            {caregiver.districts.length > 0 && (
              <View style={styles.where}>
                <Icon name="map-pin" size={18} color="inkMuted" />
                <Text color="inkMuted" style={[styles.flex, styles.whereText]}>
                  {joinNames(caregiver.districts.map((d) => d.name))}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.stats}>
            <View>
              <View style={styles.stat}>
                <Icon name="star" size={22} filled />
                <Text style={styles.statValue}>{caregiver.rating?.toFixed(1) ?? 'Nuevo'}</Text>
              </View>
              <Text variant="caption" color="inkMuted">
                {caregiver.rating === null
                  ? 'Aún sin reseñas'
                  : `de ${caregiver.ratingCount} ${caregiver.ratingCount === 1 ? 'reseña' : 'reseñas'}`}
              </Text>
            </View>
            <View>
              <Text style={styles.statValue}>{caregiver.completedBookingCount}</Text>
              <Text variant="caption" color="inkMuted">
                servicios en Pawie
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
                  {caregiver.instantBooking && '. Acepta al instante'}
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

          <Verified caregiver={caregiver} />

          {(caregiver.bio || caregiver.skills.length > 0) && (
            <Section title={`Sobre ${name}`}>
              {caregiver.bio && <Text>{caregiver.bio}</Text>}
              {caregiver.skills.length > 0 && (
                // RN-CUI-19: declared by the caregiver and not verified, so they aren't placas.
                <Text color="inkMuted">
                  Dice que tiene experiencia con{' '}
                  {joinNames(caregiver.skills.map((skill) => SKILL_NAMES[skill].toLowerCase()))}.
                </Text>
              )}
            </Section>
          )}

          <Section title="Sus precios">
            <View>
              {SERVICE_ORDER.map((code, index) => (
                <PriceRow
                  key={code}
                  code={code}
                  prices={caregiver.prices}
                  detail={
                    {
                      WALK: `${rules?.walkMinutes ?? 45} min, solo perros`,
                      HOME_VISIT: visitLength(rules?.homeVisitMinutes ?? 60),
                      OVERNIGHT_STAY: `De ${minuteLabel(rules?.overnightStartMinute ?? 1140)} a ${minuteLabel(rules?.overnightEndMinute ?? 480)}`,
                    }[code]
                  }
                  divider={index > 0}
                />
              ))}
            </View>
            <Text variant="caption" color="inkMuted">
              El precio es el mismo para todas las mascotas, también las Especiales. Cada mascota
              adicional suma 50%.
            </Text>
          </Section>
        </Animated.View>
      </ScrollView>

      {search && price && (
        <BottomBar
          amount={formatMoney(price.priceCents, { short: true })}
          caption={`Precio ${serviceUnit(search.serviceCode)}`}
        >
          <Button
            label={`Reservar ${serviceShortName(search.serviceCode).toLowerCase()}`}
            onPress={() => router.push({ pathname: '/reservar', params: { caregiverId: id } })}
          />
        </BottomBar>
      )}
    </SafeAreaView>
  );
}

/** RN-CUI-03, RN-CUI-05: badges and certifications as placas, two per row. */
function Verified({ caregiver }: { caregiver: CaregiverProfileResponse }) {
  if (caregiver.badges.length === 0 && caregiver.certifications.length === 0) return null;

  return (
    <Section title="Verificado por Pawie">
      <View style={styles.grid}>
        {caregiver.badges.map((badge) => (
          <View key={badge} style={styles.cell}>
            <Tag kind="badge" label={BADGE_NAMES[badge]} icon={BADGE_ICONS[badge]} wrap />
          </View>
        ))}
        {caregiver.certifications.map(({ code, name }) => (
          <View key={code} style={styles.cell}>
            {code === 'SPECIAL_CARE' ? (
              <Tag kind="star" label={name} wrap />
            ) : (
              <Tag kind="certification" label={name} wrap />
            )}
          </View>
        ))}
      </View>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {children}
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
  divider,
}: {
  code: ServiceCode;
  prices: CaregiverPrice[];
  detail: string;
  divider: boolean;
}) {
  const price = prices.find((p) => p.serviceCode === code);
  const { color, icon } = services[code];

  return (
    <Row divider={divider}>
      <View style={[styles.swatch, { backgroundColor: colors[color] }]}>
        <Icon name={icon} />
      </View>
      <View style={styles.flex}>
        <Text variant="subheading" style={styles.priceName}>
          {serviceName(code)}
        </Text>
        <Text variant="caption" color="inkMuted">
          {detail}
        </Text>
      </View>
      <Text variant="priceSmall">
        {price ? formatMoney(price.priceCents, { short: true }) : '—'}
      </Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  error: { alignSelf: 'stretch', gap: space[4], padding: gutter },
  content: { paddingHorizontal: gutter, paddingTop: space[1], paddingBottom: space[8] },
  flex: { flex: 1 },
  hero: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginTop: space[2] },
  collar: { flex: 1, marginTop: 18 },
  body: { gap: space[6], marginTop: 18 },
  identity: { gap: space[2] },
  where: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  whereText: { fontSize: 15 },
  stats: { flexDirection: 'row', gap: space[8] },
  stat: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  statValue: { ...typography.price, fontSize: 30, lineHeight: 34 },
  available: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderRadius: radius.md,
    backgroundColor: colors.tint,
  },
  section: { gap: space[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', margin: -space[1] },
  cell: { width: '50%', padding: space[1] },
  swatch: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  priceName: { fontSize: 17 },
});
