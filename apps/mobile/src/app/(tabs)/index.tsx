import {
  useAddressesList,
  useCatalogGet,
  usePetsList,
  useUsersMe,
  type ApiError,
  type CaregiverSearchResponse,
  type CaregiverLevel,
  type CaregiverSearchResult,
  type CatalogResponse,
  type PetResponse,
  type ServiceCode,
} from '@pawie/api-client';
import type { UseQueryResult } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Select } from '@/components/Select';
import { Sheet } from '@/components/Sheet';
import { Tag } from '@/components/Tag';
import { Text } from '@/components/Text';
import { Touchable } from '@/components/Touchable';
import { errorMessage } from '@/lib/api';
import { serviceName, serviceUnit } from '@/lib/bookings';
import { CERTIFICATION_FILTERS, LEVEL_NAMES, levelLabel } from '@/lib/caregivers';
import {
  atLocalTime,
  dayLabel,
  daysUntil,
  formatDay,
  formatMoney,
  upcomingDays,
} from '@/lib/format';
import { setSearch, useSearch, useSearchResults, type Search } from '@/lib/search';
import { colors, fontFamily, radius, space, type ColorName } from '@/theme/tokens';

// Visits start on the hour, from 7:00 to 19:00, when the overnight stay begins (RN-SER-02).
const VISIT_HOURS = Array.from({ length: 13 }, (_, i) => (7 + i) * 60);
const DAYS_AHEAD = 14;
const PHOTO_COLORS: ColorName[] = ['grape', 'sky', 'sage'];
const LEVELS: CaregiverLevel[] = ['TRUSTED', 'PRO', 'SUPER'];
const RATINGS = [4, 4.5, 4.8];

export default function SearchScreen() {
  const me = useUsersMe();
  const pets = usePetsList();
  const addresses = useAddressesList();
  const catalog = useCatalogGet();
  const search = useSearch();
  const [editing, setEditing] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // The first search: the first pet, tomorrow at 9:00, in the district of its home.
  useEffect(() => {
    if (search || !pets.data?.length || !addresses.data || !catalog.data) return;
    const districtId =
      addresses.data[0]?.district.id ??
      catalog.data.districts.find((d) => d.slug === 'san-salvador')?.id ??
      catalog.data.districts[0]?.id;
    if (!districtId) return;
    setSearch({
      petIds: [pets.data[0].id],
      serviceCode: 'HOME_VISIT',
      day: upcomingDays(2)[1],
      minute: 9 * 60,
      districtId,
      certificationCodes: [],
    });
  }, [search, pets.data, addresses.data, catalog.data]);

  const results = useSearchResults(search);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([pets.refetch(), results.refetch()]);
    setRefreshing(false);
  };

  const loading = pets.isPending || addresses.isPending || catalog.isPending;
  const failed = pets.isError || addresses.isError || catalog.isError;

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
        <View>
          <Text variant="title" accessibilityRole="header">
            {me.data ? `Hola, ${me.data.firstName}` : 'Hola'}
          </Text>
          <Text color="inkMuted">¿A quién cuidamos esta vez?</Text>
        </View>

        {me.data?.firstServiceFeeWaiverEndsAt && (
          <Banner
            tone="success"
            message={`Tu primer servicio sin tarifa. ${daysLeftText(daysUntil(me.data.firstServiceFeeWaiverEndsAt))}`}
          />
        )}

        {loading ? (
          <ActivityIndicator color={colors.grapeDeep} style={styles.loading} />
        ) : failed ? (
          <>
            <Banner
              tone="error"
              message="No pudimos cargar tus datos. Revisa tu conexión e intenta de nuevo."
            />
            <Button label="Reintentar" onPress={refresh} />
          </>
        ) : pets.data.length === 0 ? (
          <NoPets />
        ) : (
          search &&
          catalog.data && (
            <>
              <Card style={styles.searchCard}>
                <PetToggles
                  pets={pets.data}
                  selected={search.petIds}
                  max={catalog.data.bookingRules.maxPetsPerBooking}
                  onChange={(petIds) => setSearch({ ...search, petIds })}
                />
                {results.data?.careLevel === 'SPECIAL' && (
                  <View style={styles.special}>
                    <Text variant="caption">
                      Una de tus mascotas necesita cuidado especial: te mostramos solo cuidadores ⭐
                      Certificados.
                    </Text>
                  </View>
                )}
                <Touchable
                  accessibilityRole="button"
                  accessibilityLabel={`Cambiar servicio, distrito y fecha. Ahora: ${describeSearch(search)}`}
                  onPress={() => setEditing(true)}
                  pressedScale={0.98}
                  style={styles.when}
                >
                  <Icon name="calendar" />
                  <View style={styles.whenText}>
                    <Text variant="label">{describeSearch(search)}</Text>
                    <Text variant="caption" color="inkMuted">
                      {catalog.data.districts.find((d) => d.id === search.districtId)?.name}
                    </Text>
                  </View>
                  <Text variant="label" color="grapeDeep">
                    Cambiar
                  </Text>
                </Touchable>
                <Button
                  variant="secondary"
                  label={filterCount(search) > 0 ? `Filtros (${filterCount(search)})` : 'Filtros'}
                  icon={<Icon name="sliders-horizontal" />}
                  onPress={() => setFiltering(true)}
                />
              </Card>

              <Results search={search} query={results} />

              {filtering && <FiltersSheet onClose={() => setFiltering(false)} search={search} />}

              {editing && (
                <SearchSheet
                  onClose={() => setEditing(false)}
                  search={search}
                  catalog={catalog.data}
                />
              )}
            </>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** "Visita · Lun 19 oct, 9:00" or "Pernocta · Lun 19 oct". */
function describeSearch({ serviceCode, day, minute }: Search): string {
  const date = new Date(atLocalTime(day, minute));
  return serviceCode === 'OVERNIGHT_STAY'
    ? `Pernocta · ${formatDay(date)}`
    : `Visita · ${formatDay(date)}, ${minute / 60}:00`;
}

/** How many filters are on. */
function filterCount({ minLevel, certificationCodes, minRating }: Search): number {
  return (minLevel ? 1 : 0) + certificationCodes.length + (minRating ? 1 : 0);
}

/** "Te quedan 12 días para reservarlo." */
function daysLeftText(days: number): string {
  if (days <= 1) return 'Hoy es el último día para reservarlo.';
  return `Te quedan ${days} días para reservarlo.`;
}

function PetToggles({
  pets,
  selected,
  max,
  onChange,
}: {
  pets: PetResponse[];
  selected: string[];
  max: number;
  onChange: (petIds: string[]) => void;
}) {
  const toggle = (petId: string) => {
    if (selected.includes(petId)) {
      // The search needs at least one pet.
      if (selected.length > 1) onChange(selected.filter((id) => id !== petId));
    } else if (selected.length < max) {
      onChange([...selected, petId]);
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="Mascotas"
      contentContainerStyle={styles.pets}
    >
      {pets.map((pet) => {
        const on = selected.includes(pet.id);
        return (
          <Touchable
            key={pet.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={pet.name}
            onPress={() => toggle(pet.id)}
            pressedScale={0.94}
            style={styles.petTouch}
          >
            <View style={[styles.pet, on ? styles.petOn : styles.petOff]}>
              <View style={styles.petInitial}>
                <Text variant="caption" style={styles.bold}>
                  {pet.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text variant="label">{pet.name}</Text>
            </View>
          </Touchable>
        );
      })}
      <IconButton
        icon="plus"
        variant="plain"
        color="grapeDeep"
        accessibilityLabel="Agregar mascota"
        onPress={() => router.push('/mascotas/nueva')}
      />
    </ScrollView>
  );
}

function Results({
  search,
  query,
}: {
  search: Search;
  query: UseQueryResult<CaregiverSearchResponse, ApiError>;
}) {
  if (query.isPending) {
    return <ActivityIndicator color={colors.grapeDeep} style={styles.loading} />;
  }
  if (query.isError) {
    return <Banner tone="error" message={errorMessage(query.error)} />;
  }

  const { results } = query.data;
  return (
    <View style={[styles.results, query.isPlaceholderData && styles.stale]}>
      <View>
        <Text variant="heading" accessibilityRole="header">
          {results.length === 1
            ? '1 cuidador disponible'
            : `${results.length} cuidadores disponibles`}
        </Text>
        <Text variant="caption" color="inkMuted">
          {results.length > 0
            ? 'Ordenados por calificación'
            : 'Prueba con otro día, otra hora, otro distrito o menos filtros.'}
        </Text>
      </View>
      {results.map((caregiver, index) => (
        <Animated.View key={caregiver.id} entering={FadeInDown.delay(index * 60).duration(300)}>
          <CaregiverCard
            caregiver={caregiver}
            serviceCode={search.serviceCode}
            photoColor={PHOTO_COLORS[index % PHOTO_COLORS.length]}
          />
        </Animated.View>
      ))}
    </View>
  );
}

function CaregiverCard({
  caregiver,
  serviceCode,
  photoColor,
}: {
  caregiver: CaregiverSearchResult;
  serviceCode: ServiceCode;
  photoColor: ColorName;
}) {
  const price = caregiver.prices.find((p) => p.serviceCode === serviceCode);
  const initials = caregiver.displayName
    .split(' ')
    .map((word) => word.charAt(0))
    .join('');

  return (
    <Card
      onPress={() => router.push(`/cuidadores/${caregiver.id}`)}
      accessibilityLabel={`${caregiver.displayName}, ver perfil`}
      style={styles.caregiver}
    >
      <View style={[styles.photo, { backgroundColor: colors[photoColor] }]}>
        {caregiver.photoUrl ? (
          <Image source={caregiver.photoUrl} contentFit="cover" style={StyleSheet.absoluteFill} />
        ) : (
          <Text variant="title">{initials}</Text>
        )}
      </View>
      <View style={styles.caregiverText}>
        <View style={styles.caregiverTop}>
          <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
            {caregiver.displayName}
          </Text>
          {price && (
            <Text variant="bodyStrong">{formatMoney(price.priceCents, { short: true })}</Text>
          )}
        </View>
        <View style={styles.tags}>
          <Tag tone="level" label={levelLabel(caregiver.level)} />
          {caregiver.hasSpecialCareCertification && (
            <Tag tone="certified" label="⭐ Con certificación" />
          )}
          {caregiver.isVetStudent && <Tag tone="info" label="Estudiante de veterinaria" />}
        </View>
        <View style={styles.rating}>
          <Icon name="star" size={14} />
          <Text variant="caption">
            {caregiver.rating?.toFixed(1) ?? 'Nuevo'}
            <Text variant="caption" color="inkMuted">
              {caregiver.rating !== null && ` (${caregiver.ratingCount})`} ·{' '}
              {caregiver.completedBookingCount} servicios · {serviceUnit(serviceCode)}
            </Text>
          </Text>
        </View>
      </View>
    </Card>
  );
}

/** RN-RES-10: minimum level, certifications and minimum rating. Mounted only while open. */
function FiltersSheet({ onClose, search }: { onClose: () => void; search: Search }) {
  const [draft, setDraft] = useState(search);
  const toggleCertification = (code: string) =>
    setDraft({
      ...draft,
      certificationCodes: draft.certificationCodes.includes(code)
        ? draft.certificationCodes.filter((c) => c !== code)
        : [...draft.certificationCodes, code],
    });

  return (
    <Sheet
      visible
      onClose={onClose}
      title="Filtros"
      footer={
        <>
          <Button
            label="Ver cuidadores"
            onPress={() => {
              setSearch(draft);
              onClose();
            }}
          />
          <Button
            variant="ghost"
            label="Quitar filtros"
            onPress={() =>
              setDraft({
                ...draft,
                minLevel: undefined,
                certificationCodes: [],
                minRating: undefined,
              })
            }
          />
        </>
      }
    >
      <SheetSection label="Nivel mínimo">
        <View style={styles.hours}>
          <View style={styles.filter}>
            <Chip
              label="Todos"
              selected={!draft.minLevel}
              onPress={() => setDraft({ ...draft, minLevel: undefined })}
            />
          </View>
          {LEVELS.map((level) => (
            <View key={level} style={styles.filter}>
              <Chip
                label={LEVEL_NAMES[level]}
                selected={draft.minLevel === level}
                onPress={() => setDraft({ ...draft, minLevel: level })}
              />
            </View>
          ))}
        </View>
      </SheetSection>

      <SheetSection label="Certificaciones">
        <View style={styles.hours}>
          {CERTIFICATION_FILTERS.map(({ code, label }) => (
            <View key={code} style={styles.filter}>
              <Chip
                label={label}
                selected={draft.certificationCodes.includes(code)}
                onPress={() => toggleCertification(code)}
              />
            </View>
          ))}
        </View>
      </SheetSection>

      <SheetSection label="Calificación mínima">
        <View style={styles.hours}>
          <View style={styles.filter}>
            <Chip
              label="Todas"
              selected={!draft.minRating}
              onPress={() => setDraft({ ...draft, minRating: undefined })}
            />
          </View>
          {RATINGS.map((rating) => (
            <View key={rating} style={styles.filter}>
              <Chip
                label={`${rating.toFixed(1)}+`}
                icon={<Icon name="star" size={14} />}
                selected={draft.minRating === rating}
                onPress={() => setDraft({ ...draft, minRating: rating })}
              />
            </View>
          ))}
        </View>
      </SheetSection>
    </Sheet>
  );
}

/** Mounted only while open, so it always starts from the current search and time. */
function SearchSheet({
  onClose,
  search,
  catalog,
}: {
  onClose: () => void;
  search: Search;
  catalog: CatalogResponse;
}) {
  const [draft, setDraft] = useState(search);
  const [now] = useState(() => new Date());
  const days = upcomingDays(DAYS_AHEAD, now);
  // RN-RES-05: a visit has to be requested this long in advance.
  const earliest = now.getTime() + catalog.bookingRules.minLeadTimeMinutes * 60_000;
  const hours = VISIT_HOURS.filter(
    (minute) => new Date(atLocalTime(draft.day, minute)).getTime() >= earliest,
  );
  const hourIsValid = draft.serviceCode === 'OVERNIGHT_STAY' || hours.includes(draft.minute);

  return (
    <Sheet
      visible
      onClose={onClose}
      title="Cambiar búsqueda"
      footer={
        <Button
          label="Ver cuidadores"
          disabled={!hourIsValid}
          onPress={() => {
            setSearch(draft);
            onClose();
          }}
        />
      }
    >
      <SheetSection label="Servicio">
        <View style={styles.row}>
          {(['HOME_VISIT', 'OVERNIGHT_STAY'] as const).map((code) => (
            <View key={code} style={styles.flex}>
              <Chip
                label={serviceName(code)}
                selected={draft.serviceCode === code}
                onPress={() => setDraft({ ...draft, serviceCode: code })}
              />
            </View>
          ))}
        </View>
      </SheetSection>

      <SheetSection label={draft.serviceCode === 'OVERNIGHT_STAY' ? 'Noche del' : 'Día'}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.days}
        >
          {days.map((day) => (
            <Chip
              key={day}
              label={dayLabel(day, now)}
              selected={draft.day === day}
              onPress={() => setDraft({ ...draft, day })}
            />
          ))}
        </ScrollView>
      </SheetSection>

      {draft.serviceCode === 'HOME_VISIT' && (
        <SheetSection label="Hora">
          {hours.length > 0 ? (
            <View style={styles.hours}>
              {hours.map((minute) => (
                <View key={minute} style={styles.hour}>
                  <Chip
                    label={`${minute / 60}:00`}
                    selected={draft.minute === minute}
                    onPress={() => setDraft({ ...draft, minute })}
                  />
                </View>
              ))}
            </View>
          ) : (
            <Text color="inkMuted">
              Ya no quedan horas para hoy: las visitas se piden con 2 horas de anticipación.
            </Text>
          )}
        </SheetSection>
      )}

      <Select
        label="Distrito"
        value={draft.districtId}
        options={catalog.districts.map((d) => ({ value: d.id, label: d.name }))}
        onChange={(districtId) => setDraft({ ...draft, districtId })}
      />
    </Sheet>
  );
}

function SheetSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="label">{label}</Text>
      {children}
    </View>
  );
}

function NoPets() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyArt}>
        <Icon name="paw-print" size={64} />
      </View>
      <View style={styles.emptyText}>
        <Text variant="heading" style={styles.centered}>
          Agrega a tu mascota
        </Text>
        <Text color="inkMuted" style={styles.centered}>
          Así te mostramos cuidadores que pueden atenderla.
        </Text>
      </View>
      <Button label="Agregar mascota" onPress={() => router.push('/mascotas/nueva')} />
    </View>
  );
}

const PHOTO = 80;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { flexGrow: 1, gap: space[4], padding: space[4], paddingTop: space[6] },
  loading: { marginTop: space[8] },
  flex: { flex: 1 },
  bold: { fontFamily: fontFamily.extraBold },
  centered: { textAlign: 'center' },
  searchCard: { gap: space[3] },
  pets: { alignItems: 'center', gap: space[2] },
  petTouch: { height: 48, justifyContent: 'center' },
  pet: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingLeft: 6,
    paddingRight: space[4],
    borderRadius: 20,
  },
  petOn: { backgroundColor: colors.grape, boxShadow: `inset 0 0 0 2px ${colors.grapeDeep}` },
  petOff: { backgroundColor: colors.cream, boxShadow: `inset 0 0 0 1.5px ${colors.lineStrong}` },
  petInitial: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.card,
  },
  special: {
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderRadius: radius.sm,
    backgroundColor: colors.grape,
  },
  when: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    borderRadius: radius.sm,
  },
  whenText: { flex: 1 },
  results: { gap: space[3] },
  stale: { opacity: 0.5 },
  caregiver: { flexDirection: 'row', gap: space[3] },
  photo: {
    width: PHOTO,
    height: PHOTO,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radius.sm,
  },
  caregiverText: { flex: 1, gap: 6 },
  caregiverTop: { flexDirection: 'row', gap: space[2] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  section: { gap: space[2] },
  row: { flexDirection: 'row', gap: space[2] },
  days: { gap: space[2], paddingRight: space[4] },
  hours: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  hour: { width: '23%' },
  filter: { minWidth: '45%', flexGrow: 1 },
  empty: { flexGrow: 1, justifyContent: 'center', gap: space[4] },
  emptyArt: {
    alignSelf: 'center',
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 80,
    backgroundColor: colors.sky,
  },
  emptyText: { gap: space[1] },
});
