import {
  getCaregiverMeGetQueryKey,
  useCaregiverBookingsList,
  useCaregiverMeGet,
  useCaregiverMeLevel,
  useCaregiverMePrices,
  useCaregiverMeUpdate,
  useUsersMe,
  type CaregiverBookingResponse,
  type CaregiverLevelResponse,
  type CaregiverMeResponse,
  type CaregiverPricesResponse,
} from '@pawie/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { CaregiverBookingRow } from '@/components/CaregiverBookingRow';
import { Icon } from '@/components/Icon';
import { LevelTag } from '@/components/LevelTag';
import { Nimbus } from '@/components/Nimbus';
import { Row } from '@/components/Row';
import { StepMark } from '@/components/StepMark';
import { Text } from '@/components/Text';
import { errorMessage, queryClient } from '@/lib/api';
import { formatWhen, serviceShortName } from '@/lib/bookings';
import { REQUESTS } from '@/lib/caregiver-bookings';
import { LEVEL_NAMES, requirementText, SETUP_ORDER, SETUP_STEPS } from '@/lib/caregivers';
import { formatLongDay, formatMoney } from '@/lib/format';
import { byServiceOrder, services } from '@/theme/services';
import { colors, gutter, radius, space } from '@/theme/tokens';

// CuiInicio, after docs/design/directions/placas/cui-inicio.html. Before the caregiver shows up
// in searches, it lists what the sign-up still needs; once approved, their level, what they
// need for the next one and how much the suggested prices go up there (RN-NIV-05, RN-CUI-17),
// after the requests that wait for an answer, the most urgent first (RN-RES-11).
export default function CaregiverHomeScreen() {
  const me = useUsersMe();
  const profile = useCaregiverMeGet();
  const approved = profile.data?.status === 'APPROVED';
  const level = useCaregiverMeLevel({ query: { enabled: approved } });
  const prices = useCaregiverMePrices({ query: { enabled: approved } });
  // Push notices come in stage 11; until then, the list asks again while it's open.
  const requests = useCaregiverBookingsList(REQUESTS, {
    query: { enabled: approved, refetchInterval: REQUESTS_POLL_MS },
  });
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([
      profile.refetch(),
      approved && level.refetch(),
      approved && prices.refetch(),
      approved && requests.refetch(),
    ]);
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
        <View style={styles.hello}>
          <View style={styles.flex}>
            <Text variant="title" accessibilityRole="header">
              {me.data ? `Hola, ${me.data.firstName}` : 'Hola'}
            </Text>
            <Text color="inkMuted">{formatLongDay(new Date())}</Text>
          </View>
          {/* Nimbus: once on the screen. */}
          <Nimbus pose="hola" background="tint" size={40} />
        </View>

        {profile.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : profile.isError ? (
          <>
            <Banner tone="error" message={errorMessage(profile.error)} />
            <Button label="Reintentar" onPress={() => profile.refetch()} />
          </>
        ) : (
          <>
            <SignUp profile={profile.data} />
            {approved && (
              <Requests
                requests={requests.data}
                error={requests.isError ? errorMessage(requests.error) : null}
              />
            )}
            {approved && level.data && <LevelProgress progress={level.data} />}
            {approved && level.data?.next && prices.data && (
              <NextLevelPrices nextLevel={level.data.next.level} prices={prices.data} />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** RN-RES-11: the requests to answer, as the API sorts them: the one due first on top. */
function Requests({
  requests,
  error,
}: {
  requests: CaregiverBookingResponse[] | undefined;
  error: string | null;
}) {
  return (
    <View style={styles.section}>
      <Text variant="heading" accessibilityRole="header">
        {requests?.length ? `Solicitudes (${requests.length})` : 'Solicitudes'}
      </Text>
      {error ? (
        <Banner tone="error" message={error} />
      ) : !requests ? (
        <ActivityIndicator color={colors.primary} />
      ) : requests.length === 0 ? (
        <Text color="inkMuted">
          No tienes solicitudes por responder. Cuando un dueño te pida un servicio, aparece aquí.
        </Text>
      ) : (
        <View>
          {requests.map((booking, index) => (
            <CaregiverBookingRow
              key={booking.id}
              booking={booking}
              when={formatWhen(booking)}
              divider={index > 0}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/** What the sign-up still needs (RN-CUI-01 to RN-CUI-04), the pause and whether owners find them. */
function SignUp({ profile }: { profile: CaregiverMeResponse }) {
  const update = useCaregiverMeUpdate();
  const pending = profile.pendingSteps;
  const resume = () =>
    update.mutate(
      { data: { isPaused: false } },
      { onSuccess: (data) => queryClient.setQueryData(getCaregiverMeGetQueryKey(), data) },
    );

  if (pending.length === 0) {
    return profile.isPaused ? (
      <View style={styles.section}>
        <Banner
          tone="warning"
          icon="pause"
          message="Tu perfil está en pausa: los dueños no te encuentran en las búsquedas, pero conservas tus reservas."
        />
        {update.isError && <Banner tone="error" message={errorMessage(update.error)} />}
        <Button label="Reanudar mi perfil" loading={update.isPending} onPress={resume} />
      </View>
    ) : (
      <Banner tone="success" message="Los dueños ya te encuentran en las búsquedas." />
    );
  }

  // The first step that the caregiver can do now: the approval is Pawie's.
  const next = pending.map((step) => SETUP_STEPS[step].action).find(Boolean);
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text variant="heading" accessibilityRole="header">
          Tu alta
        </Text>
        <Text color="inkMuted">
          {pending.length === 1
            ? 'Te falta un paso para aparecer en las búsquedas.'
            : `Te faltan ${pending.length} pasos para aparecer en las búsquedas.`}
        </Text>
      </View>
      <View>
        {SETUP_ORDER.map((step, index) => {
          const { title, detail, action } = SETUP_STEPS[step];
          const done = !pending.includes(step);
          const onPress = !done && action ? () => router.push(action.href) : undefined;
          return (
            <Row
              key={step}
              divider={index > 0}
              onPress={onPress}
              accessibilityLabel={`${title}, ${done ? 'listo' : 'pendiente'}`}
            >
              <StepMark done={done} size={28} />
              <View style={styles.flex}>
                <Text variant="subheading" color={done ? 'inkMuted' : 'ink'}>
                  {title}
                </Text>
                <Text variant="caption" color="inkMuted">
                  {step === 'APPROVAL' ? approvalDetail(profile) : detail}
                </Text>
              </View>
              {onPress && <Icon name="chevron-right" color="inkMuted" />}
            </Row>
          );
        })}
      </View>
      {profile.isPaused && (
        <Banner tone="warning" icon="pause" message="Tu perfil está en pausa." />
      )}
      {next && <Button label={next.label} onPress={() => router.push(next.href)} />}
    </Animated.View>
  );
}

function approvalDetail({ status, pendingSteps }: CaregiverMeResponse): string {
  if (status === 'APPROVED') return 'Identidad y antecedentes verificados';
  if (pendingSteps.includes('DOCUMENTS')) return 'Después de que subas tus documentos';
  return 'Estamos revisando tus documentos';
}

/** RN-NIV-05: the level's placa and each requirement of the next one, met or not. */
function LevelProgress({ progress }: { progress: CaregiverLevelResponse }) {
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.level}>
      <View style={styles.collar}>
        <LevelTag level={progress.level} caption="Tu nivel" />
      </View>
      <View style={styles.flex}>
        {progress.next ? (
          <>
            <Text variant="heading" accessibilityRole="header">
              Vas camino a {LEVEL_NAMES[progress.next.level]}
            </Text>
            <View style={styles.requirements}>
              {progress.next.requirements.map((requirement) => {
                const { value, text, of } = requirementText(requirement);
                return (
                  <View
                    key={`${requirement.kind}-${requirement.certification?.code ?? ''}`}
                    accessible
                    accessibilityLabel={`${value}${text}${of ? ` ${of}` : ''}, ${requirement.met ? 'cumplido' : 'te falta'}`}
                    style={styles.requirement}
                  >
                    <StepMark done={requirement.met} />
                    <Text style={styles.flex}>
                      <Text variant="bodyStrong">{value}</Text>
                      {text}
                      {of && (
                        <Text variant="footnote" color="inkMuted">
                          {` ${of}`}
                        </Text>
                      )}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <>
            <Text variant="heading" accessibilityRole="header">
              Llegaste al nivel más alto
            </Text>
            <Text color="inkMuted">Tus rangos de precio son los más altos de Pawie.</Text>
          </>
        )}
      </View>
    </Animated.View>
  );
}

/** RN-CUI-17: the suggested price of each service now and at the next level, from the API. */
function NextLevelPrices({
  nextLevel,
  prices,
}: {
  nextLevel: CaregiverLevelResponse['level'];
  prices: CaregiverPricesResponse;
}) {
  const rising = byServiceOrder(prices.prices.filter((price) => price.nextLevel !== null));
  if (rising.length === 0) return null;

  return (
    <Animated.View entering={FadeInDown.delay(80).duration(300)} style={styles.section}>
      <Text variant="heading" accessibilityRole="header">
        En {LEVEL_NAMES[nextLevel]}, tus precios sugeridos suben
      </Text>
      <View style={styles.blocks}>
        {rising.map(({ serviceCode, range, nextLevel: next }) => {
          const { color, icon } = services[serviceCode];
          const from = formatMoney(range.suggestedCents, { short: true });
          const to = formatMoney(next!.suggestedCents, { short: true });
          return (
            <View
              key={serviceCode}
              accessible
              accessibilityLabel={`${serviceShortName(serviceCode)}: el sugerido sube de ${from} a ${to}`}
              style={[styles.block, { backgroundColor: colors[color] }]}
            >
              <View style={styles.blockName}>
                <Icon name={icon} />
                <Text variant="subheading">{serviceShortName(serviceCode)}</Text>
              </View>
              <View>
                <Text variant="footnote" color="inkMuted">
                  de {from} a
                </Text>
                <Text variant="price">{to}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

const REQUESTS_POLL_MS = 30_000;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    gap: space[6],
    paddingHorizontal: gutter,
    paddingTop: space[2],
    paddingBottom: space[8],
  },
  flex: { flex: 1 },
  loading: { marginTop: space[8] },
  hello: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  section: { gap: space[3] },
  sectionHeader: { gap: space[1] },
  level: { flexDirection: 'row', alignItems: 'flex-start', gap: space[4] },
  collar: { width: 112 },
  requirements: { gap: space[1], marginTop: space[2] },
  requirement: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 30 },
  blocks: { flexDirection: 'row', gap: 10 },
  block: {
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 112,
    gap: space[3],
    padding: 14,
    borderRadius: radius.lg,
  },
  blockName: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
