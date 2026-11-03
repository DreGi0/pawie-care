import { useBookingsList } from '@pawie/api-client';
import { Tabs } from 'expo-router/tabs';

import { Icon, type IconName } from '@/components/Icon';
import { TabBar } from '@/components/TabBar';
import { colors } from '@/theme/tokens';

/** The current tab's icon goes in `primary`, like its label. */
function tabIcon(name: IconName) {
  return function TabIcon({ focused }: { focused: boolean }) {
    return <Icon name={name} color={focused ? 'primary' : 'inkMuted'} />;
  };
}

export default function TabsLayout() {
  const bookings = useBookingsList();
  const toPay = (bookings.data ?? []).filter((b) => b.status === 'PENDING_PAYMENT').length;

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
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
      <Tabs.Screen name="cuenta" options={{ title: 'Cuenta', tabBarIcon: tabIcon('user') }} />
    </Tabs>
  );
}
