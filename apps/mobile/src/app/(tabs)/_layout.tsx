import { Tabs } from 'expo-router/tabs';

import { Icon } from '@/components/Icon';
import { TabBar } from '@/components/TabBar';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
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
        options={{ title: 'Visitas', tabBarIcon: () => <Icon name="calendar" /> }}
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
