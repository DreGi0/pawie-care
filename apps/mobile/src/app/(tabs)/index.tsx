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
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { CaregiverPhoto } from '@/components/CaregiverPhoto';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { Row } from '@/components/Row';
import { ServiceBlock } from '@/components/ServiceBlock';
import { Sheet } from '@/components/Sheet';
import { StarMedal, Tag } from '@/components/Tag';
import { Text } from '@/components/Text';
import { Touchable } from '@/components/Touchable';
import { errorMessage } from '@/lib/api';
import { joinNames, serviceShortName, serviceUnit } from '@/lib/bookings';
import { CERTIFICATION_FILTERS, LEVEL_NAMES } from '@/lib/caregivers';
import {
  atLocalTime,
  dayLabel,
  daysUntil,
  formatDay,
  formatMoney,
  upcomingDays,
} from '@/lib/format';
import { serviceTakes, setSearch, useSearch, useSearchResults, type Search } from '@/lib/search';
import { colors, fontFamily, gutter, radius, space } from '@/theme/tokens';

// Walks and visits start on the hour, from 7:00 to 19:00, when the overnight stay begins (RN-SER-02).
const DAY_HOURS = Array.from({ length: 13 }, (_, i) => (7 + i) * 60);
const DAYS_AHEAD = 14;
const LEVELS: CaregiverLevel[] = ['TRUSTED', 'PRO', 'SUPER'];
const RATINGS = [4, 4.5, 4.8];
const SERVICES = [
  { code: 'WALK', detail: 'Solo perros' },
  { code: 'HOME_VISIT', detail: 'En tu casa' },
  { code: 'OVERNIGHT_STAY', detail: 'Toda la noche' },
] as const;

type Picker = 'pets' | 'when' | 'district' | 'filters' | 'walk';

export default function SearchScreen() {
  const me = useUsersMe();
  const pets = usePetsList();
  const addresses = useAddressesList();
  const catalog = useCatalogGet();
  const search = useSearch();
  const [picker, setPicker] = useState<Picker | null>(null);
  // A search that still needs something before it runs, such as an hour that still works or
  // the dogs of a walk: the open sheet starts from it.
  const [pending, setPending] = useState<Search | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // The first search: the first pet, tomorrow at 9:00, in the district of its home. A walk if
  // the walk takes that pet (a dog), since it's the most common service; otherwise a visit.
  useEffect(() => {
    if (search || !pets.data?.length || !addresses.data || !catalog.data) return;
    const districtId =
      addresses.data[0]?.district.id ??
      catalog.data.districts.find((d) => d.slug === 'san-salvador')?.id ??
      catalog.data.districts[0]?.id;
    if (!districtId) return;
    setSearch({
      petIds: [pets.data[0].id],
      serviceCode: serviceTakes(catalog.data, 'WALK', pets.data[0]) ? 'WALK' : 'HOME_VISIT',
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

  /** Runs the search, unless its hour no longer works: then When picks one first. */
  const run = (next: Search) => {
    if (!catalog.data) return;
    if (
      next.serviceCode !== 'OVERNIGHT_STAY' &&
      !dayHours(next.day, new Date(), catalog.data).includes(next.minute)
    ) {
      setPending(next);
      setPicker('when');
      return;
    }
    setPending(null);
    setPicker(null);
    setSearch(next);
  };

  const chooseService = (serviceCode: ServiceCode) => {
    if (!search || !catalog.data || !pets.data || serviceCode === search.serviceCode) return;
    // RN-SER-05, RN-RES-01: with a cat or too many dogs, explain why before changing anything.
    if (serviceCode === 'WALK' && walkProblem(search, pets.data, catalog.data)) {
      setPicker('walk');
      return;
    }
    run({ ...search, serviceCode });
  };

  const closePicker = () => {
    setPicker(null);
    setPending(null);
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
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.hello}>
          <Text variant="title" accessibilityRole="header">
            {me.data ? `Hola, ${me.data.firstName}` : 'Hola'}
          </Text>
          <Text color="inkMuted" style={styles.subtitle}>
            ¿A quién cuidamos esta vez?
          </Text>
        </View>

        {me.data?.firstServiceFeeWaiverEndsAt && (
          <Banner
            tone="success"
            message={`Tu primer servicio sin tarifa. ${daysLeftText(daysUntil(me.data.firstServiceFeeWaiverEndsAt))}`}
          />
        )}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
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
              <View accessibilityRole="radiogroup" style={styles.services}>
                {SERVICES.map(({ code, detail }) => (
                  <ServiceBlock
                    key={code}
                    service={code}
                    detail={detail}
                    selected={search.serviceCode === code}
                    onPress={() => chooseService(code)}
                  />
                ))}
              </View>

              <Query search={search} pets={pets.data} catalog={catalog.data} onPick={setPicker} />

              {results.data?.careLevel === 'SPECIAL' && (
                <Banner
                  tone="info"
                  icon="star"
                  message="Una de tus mascotas necesita cuidado especial: te mostramos solo cuidadores ⭐ Certificados."
                />
              )}

              <Results search={search} query={results} onFilter={() => setPicker('filters')} />
            </>
          )
        )}
      </ScrollView>

      {search && catalog.data && pets.data && (
        <>
          {picker === 'pets' && (
            <PetsSheet
              onClose={closePicker}
              search={pending ?? search}
              pets={pets.data}
              catalog={catalog.data}
              onDone={run}
            />
          )}
          {picker === 'when' && (
            <WhenSheet onClose={closePicker} search={pending ?? search} catalog={catalog.data} />
          )}
          {picker === 'walk' && (
            <WalkSheet
              onClose={closePicker}
              search={search}
              pets={pets.data}
              catalog={catalog.data}
              onWalk={run}
              onChoosePets={() => {
                setPending({ ...search, serviceCode: 'WALK' });
                setPicker('pets');
              }}
            />
          )}
          {picker === 'district' && (
            <DistrictSheet onClose={closePicker} search={search} catalog={catalog.data} />
          )}
          {picker === 'filters' && <FiltersSheet onClose={closePicker} search={search} />}
        </>
      )}
    </SafeAreaView>
  );
}

/** "Te quedan 12 días para reservarlo." */
function daysLeftText(days: number): string {
  if (days <= 1) return 'Hoy es el último día para reservarlo.';
  return `Te quedan ${days} días para reservarlo.`;
}

/** How many filters are on. */
function filterCount({ minLevel, certificationCodes, minRating }: Search): number {
  return (minLevel ? 1 : 0) + certificationCodes.length + (minRating ? 1 : 0);
}

/** RN-RES-05: a walk or a visit has to be requested this long in advance. */
function dayHours(day: string, now: Date, catalog: CatalogResponse): number[] {
  const earliest = now.getTime() + catalog.bookingRules.minLeadTimeMinutes * 60_000;
  return DAY_HOURS.filter((minute) => new Date(atLocalTime(day, minute)).getTime() >= earliest);
}

/**
 * RN-SER-05, RN-RES-01, RN-RES-03: why the chosen pets can't go on a walk, or null. The species
 * and the limit come from the catalog; the API checks them again.
 */
function walkProblem(
  search: Search,
  pets: PetResponse[],
  catalog: CatalogResponse,
): { notDogs: PetResponse[]; dogs: PetResponse[] } | null {
  const chosen = pets.filter((pet) => search.petIds.includes(pet.id));
  const notDogs = chosen.filter((pet) => !serviceTakes(catalog, 'WALK', pet));
  const dogs = chosen.filter((pet) => serviceTakes(catalog, 'WALK', pet));
  return notDogs.length > 0 || dogs.length > catalog.bookingRules.maxDogsPerWalk
    ? { notDogs, dogs }
    : null;
}

/** The search as a sentence: "Para [Toby] el [mar 20 oct, 9:00] en [San Salvador]". */
function Query({
  search,
  pets,
  catalog,
  onPick,
}: {
  search: Search;
  pets: PetResponse[];
  catalog: CatalogResponse;
  onPick: (picker: Picker) => void;
}) {
  const selected = pets.filter((pet) => search.petIds.includes(pet.id));
  const names = joinNames(selected.map((pet) => pet.name));
  // With several pets the chip says "Toby y 2 más", without a photo: one photo doesn't stand for
  // all of them, and that keeps the date on the first line, so the sentence takes two lines.
  const several = selected.length > 1;
  const shortNames = several ? `${selected[0].name} y ${selected.length - 1} más` : names;
  const date = new Date(atLocalTime(search.day, search.minute));
  const day = formatDay(date).toLowerCase();
  const overnight = search.serviceCode === 'OVERNIGHT_STAY';
  const when = overnight ? day : `${day}, ${search.minute / 60}:00`;
  const district = catalog.districts.find((d) => d.id === search.districtId)?.name ?? '';

  return (
    <View style={styles.query}>
      <Text style={styles.queryText}>Para</Text>
      <Chip
        label={shortNames}
        photo={
          selected[0] && !several ? (
            <Avatar name={selected[0].name} photoUrl={selected[0].photoUrl} size={36} />
          ) : undefined
        }
        accessibilityLabel={`Mascotas: ${names}. Cambiar`}
        onPress={() => onPick('pets')}
      />
      <Text style={styles.queryText}>{overnight ? 'la noche del' : 'el'}</Text>
      <Chip
        label={when}
        icon={<Icon name="calendar" size={16} color="primary" />}
        accessibilityLabel={`${overnight ? 'Noche' : 'Día y hora'}: ${when}. Cambiar`}
        onPress={() => onPick('when')}
      />
      <Text style={styles.queryText}>en</Text>
      <Chip
        label={district}
        icon={<Icon name="map-pin" size={16} color="primary" />}
        accessibilityLabel={`Distrito: ${district}. Cambiar`}
        onPress={() => onPick('district')}
      />
    </View>
  );
}

function Results({
  search,
  query,
  onFilter,
}: {
  search: Search;
  query: UseQueryResult<CaregiverSearchResponse, ApiError>;
  onFilter: () => void;
}) {
  const filters = filterCount(search);

  return (
    <View style={styles.results}>
      <View style={styles.resultsHead}>
        <View style={styles.flex}>
          {query.data ? (
            <>
              <Text variant="heading" accessibilityRole="header">
                {query.data.results.length === 1
                  ? '1 cuidador disponible'
                  : `${query.data.results.length} cuidadores disponibles`}
              </Text>
              <Text variant="caption" color="inkMuted">
                {query.data.results.length > 0
                  ? 'Ordenados por calificación'
                  : 'Prueba con otro día, otra hora, otro distrito o menos filtros.'}
              </Text>
            </>
          ) : (
            <Text variant="heading" accessibilityRole="header">
              Cuidadores
            </Text>
          )}
        </View>
        <Button
          variant="secondary"
          label={filters > 0 ? `Filtros (${filters})` : 'Filtros'}
          icon={<Icon name="sliders-horizontal" />}
          onPress={onFilter}
        />
      </View>

      {query.isPending ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : query.isError ? (
        <Banner tone="error" message={errorMessage(query.error)} />
      ) : (
        <View style={query.isPlaceholderData && styles.stale}>
          {query.data.results.map((caregiver, index) => (
            <Animated.View key={caregiver.id} entering={FadeInDown.delay(index * 60).duration(300)}>
              <CaregiverRow
                caregiver={caregiver}
                serviceCode={search.serviceCode}
                divider={index > 0}
              />
            </Animated.View>
          ))}
        </View>
      )}
    </View>
  );
}

function CaregiverRow({
  caregiver,
  serviceCode,
  divider,
}: {
  caregiver: CaregiverSearchResult;
  serviceCode: ServiceCode;
  divider: boolean;
}) {
  const price = caregiver.prices.find((p) => p.serviceCode === serviceCode);

  return (
    <Row
      divider={divider}
      onPress={() => router.push(`/cuidadores/${caregiver.id}`)}
      accessibilityLabel={`${caregiver.displayName}, ver perfil`}
    >
      <CaregiverPhoto name={caregiver.displayName} photoUrl={caregiver.photoUrl} />
      <View style={styles.who}>
        <Text variant="subheading" numberOfLines={1}>
          {caregiver.displayName}
        </Text>
        <Rating rating={caregiver.rating} count={caregiver.ratingCount} />
        <View style={styles.tags}>
          <Tag kind="level" level={caregiver.level} size="sm" />
          {caregiver.hasSpecialCareCertification && <StarMedal />}
        </View>
      </View>
      {price && (
        <View style={styles.price}>
          <Text variant="price">{formatMoney(price.priceCents, { short: true })}</Text>
          <Text variant="footnote" color="inkMuted">
            {serviceUnit(serviceCode)}
          </Text>
        </View>
      )}
    </Row>
  );
}

/** "★ 4.8 de 46 reseñas", or "Nuevo" while nobody has rated it. The star is ink, never `star`. */
function Rating({ rating, count }: { rating: number | null; count: number }) {
  return (
    <View style={styles.rating}>
      <Icon name="star" size={15} filled />
      {rating === null ? (
        <Text variant="caption">Nuevo</Text>
      ) : (
        <Text variant="caption" color="inkMuted">
          <Text variant="caption" color="ink" style={styles.bold}>
            {rating.toFixed(1)}
          </Text>{' '}
          de {count} {count === 1 ? 'reseña' : 'reseñas'}
        </Text>
      )}
    </View>
  );
}

/**
 * Mounted only while open, so it always starts from the search. A walk takes only dogs, up to
 * its own limit (RN-SER-05): the sheet lists the dogs and says who can't go.
 */
function PetsSheet({
  onClose,
  search,
  pets,
  catalog,
  onDone,
}: {
  onClose: () => void;
  search: Search;
  pets: PetResponse[];
  catalog: CatalogResponse;
  onDone: (search: Search) => void;
}) {
  const walk = search.serviceCode === 'WALK';
  const max = walk ? catalog.bookingRules.maxDogsPerWalk : catalog.bookingRules.maxPetsPerBooking;
  const allowed = pets.filter((pet) => serviceTakes(catalog, search.serviceCode, pet));
  const left = pets.filter((pet) => !allowed.includes(pet));
  const [petIds, setPetIds] = useState(() =>
    search.petIds.filter((id) => allowed.some((pet) => pet.id === id)).slice(0, max),
  );
  const toggle = (petId: string) => {
    if (petIds.includes(petId)) {
      // The search needs at least one pet.
      if (petIds.length > 1) setPetIds(petIds.filter((id) => id !== petId));
    } else if (petIds.length < max) {
      setPetIds([...petIds, petId]);
    }
  };
  const label = walk
    ? max === 1
      ? 'Un perro por paseo'
      : `Hasta ${max} perros por paseo`
    : max === 1
      ? 'Una mascota por reserva'
      : `Hasta ${max} por reserva`;

  return (
    <Sheet
      visible
      onClose={onClose}
      title="¿Para quién?"
      footer={
        <Button
          label="Ver cuidadores"
          disabled={petIds.length === 0}
          onPress={() => onDone({ ...search, petIds })}
        />
      }
    >
      <SheetSection label={label}>
        <View style={styles.wrap}>
          {allowed.map((pet) => (
            <Chip
              key={pet.id}
              label={pet.name}
              icon={<Avatar name={pet.name} photoUrl={pet.photoUrl} size={28} />}
              selected={petIds.includes(pet.id)}
              onPress={() => toggle(pet.id)}
            />
          ))}
        </View>
        {left.length > 0 && (
          <Text variant="caption" color="inkMuted">
            {joinNames(left.map((pet) => pet.name))} no {left.length === 1 ? 'puede' : 'pueden'} ir:
            el paseo es solo para perros.
          </Text>
        )}
      </SheetSection>
      <Button
        variant="ghost"
        label="Agregar mascota"
        icon={<Icon name="plus" color="primary" />}
        onPress={() => {
          onClose();
          router.push('/mascotas/nueva');
        }}
        style={styles.start}
      />
    </Sheet>
  );
}

/**
 * RN-SER-05, RN-RES-01: why the chosen pets can't go on a walk. The search stays as it is until
 * the owner picks an option: the app never drops a pet on its own.
 */
function WalkSheet({
  onClose,
  search,
  pets,
  catalog,
  onWalk,
  onChoosePets,
}: {
  onClose: () => void;
  search: Search;
  pets: PetResponse[];
  catalog: CatalogResponse;
  onWalk: (search: Search) => void;
  onChoosePets: () => void;
}) {
  const problem = walkProblem(search, pets, catalog);
  if (!problem) return null;
  const { notDogs, dogs } = problem;
  const max = catalog.bookingRules.maxDogsPerWalk;
  const ownsDogs = pets.some((pet) => serviceTakes(catalog, 'WALK', pet));
  const walkTheDogs = dogs.length > 0 && dogs.length <= max;
  const dogNames = joinNames(dogs.map((pet) => pet.name));
  const stay = `Seguir con la ${serviceShortName(search.serviceCode).toLowerCase()}`;

  let message: string;
  if (notDogs.length === 0) {
    message = `Elegiste ${dogs.length} perros. Elige hasta ${max} para el paseo.`;
  } else {
    const who = joinNames(notDogs.map((pet) => pet.name));
    const cannot = `${who} no ${notDogs.length === 1 ? 'puede' : 'pueden'} ir a un paseo.`;
    const next = walkTheDogs
      ? `Puedes buscar el paseo solo para ${dogNames}.`
      : ownsDogs
        ? 'Elige qué perros van al paseo.'
        : 'Ninguna de tus mascotas es perro.';
    message = `${cannot} ${next}`;
  }

  return (
    <Sheet
      visible
      onClose={onClose}
      title={notDogs.length > 0 ? 'El paseo es solo para perros' : `Hasta ${max} perros por paseo`}
      footer={
        walkTheDogs ? (
          <>
            <Button
              label={`Buscar paseo para ${dogNames}`}
              onPress={() =>
                onWalk({ ...search, serviceCode: 'WALK', petIds: dogs.map((pet) => pet.id) })
              }
            />
            <Button variant="ghost" label={stay} onPress={onClose} />
          </>
        ) : ownsDogs ? (
          <>
            <Button label="Elegir perros" onPress={onChoosePets} />
            <Button variant="ghost" label={stay} onPress={onClose} />
          </>
        ) : (
          <Button label={stay} onPress={onClose} />
        )
      }
    >
      <View style={styles.wrap}>
        {pets
          .filter((pet) => search.petIds.includes(pet.id))
          .map((pet) => (
            <View key={pet.id} style={styles.walkPet}>
              <Avatar name={pet.name} photoUrl={pet.photoUrl} size={36} />
              <View>
                <Text variant="bodyStrong">{pet.name}</Text>
                <Text variant="caption" color="inkMuted">
                  {pet.species.name}
                </Text>
              </View>
            </View>
          ))}
      </View>
      <Text>{message}</Text>
    </Sheet>
  );
}

/** Mounted only while open, so it always starts from the current search and time. */
function WhenSheet({
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
  const hours = dayHours(draft.day, now, catalog);
  const overnight = draft.serviceCode === 'OVERNIGHT_STAY';
  const hourIsValid = overnight || hours.includes(draft.minute);

  return (
    <Sheet
      visible
      onClose={onClose}
      title={overnight ? '¿Qué noche?' : '¿Cuándo?'}
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
      <SheetSection label={overnight ? 'Noche del' : 'Día'}>
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

      {!overnight && (
        <SheetSection label="Hora">
          {hours.length > 0 ? (
            <View style={styles.wrap}>
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
              Ya no quedan horas para hoy:{' '}
              {draft.serviceCode === 'WALK' ? 'los paseos' : 'las visitas'} se piden con 2 horas de
              anticipación.
            </Text>
          )}
        </SheetSection>
      )}
    </Sheet>
  );
}

function DistrictSheet({
  onClose,
  search,
  catalog,
}: {
  onClose: () => void;
  search: Search;
  catalog: CatalogResponse;
}) {
  return (
    <Sheet visible onClose={onClose} title="¿En qué distrito?">
      <View>
        {catalog.districts.map((district) => {
          const selected = district.id === search.districtId;
          return (
            <Touchable
              key={district.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                setSearch({ ...search, districtId: district.id });
                onClose();
              }}
              pressedScale={0.98}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <Text variant={selected ? 'bodyStrong' : 'body'} style={styles.flex}>
                {district.name}
              </Text>
              {selected && <Icon name="check" color="primary" />}
            </Touchable>
          );
        })}
      </View>
    </Sheet>
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
        <View style={styles.wrap}>
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
        <View style={styles.wrap}>
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
        <View style={styles.wrap}>
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
                icon={<Icon name="star" size={14} filled />}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    gap: 18,
    paddingHorizontal: gutter,
    paddingTop: space[2],
    paddingBottom: space[6],
  },
  hello: { gap: space[1] },
  subtitle: { fontSize: 17 },
  loading: { marginTop: space[8] },
  flex: { flex: 1 },
  bold: { fontFamily: fontFamily.textBold },
  centered: { textAlign: 'center' },
  start: { alignSelf: 'flex-start' },
  services: { flexDirection: 'row', gap: 10 },
  query: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 8 },
  queryText: { fontSize: 17 },
  results: { marginTop: space[2] },
  resultsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingBottom: space[1],
  },
  stale: { opacity: 0.5 },
  who: { flex: 1, gap: 2 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  price: { alignItems: 'flex-end' },
  section: { gap: space[3] },
  days: { gap: space[2], paddingRight: gutter },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  hour: { width: '23%' },
  filter: { minWidth: '45%', flexGrow: 1 },
  walkPet: { flexDirection: 'row', alignItems: 'center', gap: space[2], minWidth: '45%' },
  option: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    borderRadius: radius.sm,
  },
  optionSelected: { backgroundColor: colors.tint },
  empty: { flexGrow: 1, justifyContent: 'center', gap: space[4] },
  emptyArt: {
    alignSelf: 'center',
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 80,
    backgroundColor: colors.tint,
  },
  emptyText: { gap: space[1] },
});
