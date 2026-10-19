import { useBookingsList } from '@pawie/api-client';
import { Tabs } from 'expo-router/tabs';

import { Icon } from '@/components/Icon';
import { TabBar } from '@/components/TabBar';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  const bookings = useBookingsList();
  const toPay = (bookings.data ?? []).filter((b) => b.status === 'PENDING_PAYMENT').length;

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.cream } }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Buscar', tabBarIcon: () => <Icon name="search" /> }}
      />
      <Tabs.Screen
        name="visitas"
        options={{
          title: 'Visitas',
          tabBarIcon: () => <Icon name="calendar" />,
          tabBarBadge: toPay > 0 ? toPay : undefined,
          tabBarAccessibilityLabel:
            toPay > 0 ? `Visitas, ${toPay} pendiente${toPay > 1 ? 's' : ''} de pago` : undefined,
        }}
      />
      <Tabs.Screen
        name="mascotas"
        options={{ title: 'Mascotas', tabBarIcon: () => <Icon name="paw-print" /> }}
      />
      <Tabs.Screen
        name="cuenta"
        options={{ title: 'Cuenta', tabBarIcon: () => <Icon name="user" /> }}
      />
    </Tabs>
  );
}
