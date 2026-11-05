import { useBookingsList } from '@pawie/api-client';
import { Tabs } from 'expo-router/tabs';

import { Icon, type IconName } from '@/components/Icon';
import { TabBar } from '@/components/TabBar';
import { HOME } from '@/lib/mode';
import { useMode } from '@/lib/session';
import { colors } from '@/theme/tokens';

/** The current tab's icon goes in `primary`, like its label. */
function tabIcon(name: IconName) {
  return function TabIcon({ focused }: { focused: boolean }) {
    return <Icon name={name} color={focused ? 'primary' : 'inkMuted'} />;
  };
}

// RN-CTA-06: the tabs follow the account's mode. Cuenta is in both.
export default function TabsLayout() {
  const mode = useMode();
  const bookings = useBookingsList({ query: { enabled: mode === 'OWNER' } });
  const toPay = (bookings.data ?? []).filter((b) => b.status === 'PENDING_PAYMENT').length;

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      {/* Each mode's tabs send the other mode to its home: without it, opening "/" in caregiver
          mode landed on Cuenta. */}
      <Tabs.Protected guard={mode === 'OWNER'} redirectTo={HOME.CAREGIVER}>
        <Tabs.Screen name="index" options={{ title: 'Buscar', tabBarIcon: tabIcon('search') }} />
        <Tabs.Screen
          name="visitas"
          options={{
            title: 'Visitas',
            tabBarIcon: tabIcon('calendar'),
            tabBarBadge: toPay > 0 ? toPay : undefined,
            tabBarAccessibilityLabel:
              toPay > 0 ? `Visitas, ${toPay} pendiente${toPay > 1 ? 's' : ''} de pago` : undefined,
          }}
        />
        <Tabs.Screen
          name="mascotas"
          options={{ title: 'Mascotas', tabBarIcon: tabIcon('paw-print') }}
        />
      </Tabs.Protected>
      <Tabs.Protected guard={mode === 'CAREGIVER'} redirectTo={HOME.OWNER}>
        <Tabs.Screen name="inicio" options={{ title: 'Inicio', tabBarIcon: tabIcon('house') }} />
        <Tabs.Screen name="agenda" options={{ title: 'Agenda', tabBarIcon: tabIcon('calendar') }} />
        <Tabs.Screen
          name="ganancias"
          options={{ title: 'Ganancias', tabBarIcon: tabIcon('wallet') }}
        />
      </Tabs.Protected>
      <Tabs.Screen name="cuenta" options={{ title: 'Cuenta', tabBarIcon: tabIcon('user') }} />
    </Tabs>
  );
}
