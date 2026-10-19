import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, fontFamily, radius, shadow, space } from '@/theme/tokens';

import { Text } from './Text';

/**
 * The `tabBar` of expo-router's Tabs. Each screen sets `title`, `tabBarIcon` and, to show a
 * count, `tabBarBadge` and `tabBarAccessibilityLabel` (such as "Visitas, 1 pendiente de pago").
 */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space[2]) }]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = options.title ?? route.name;

        const onPress = () => {
          const event = emitter.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigateToTab(route.key);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            onPress={onPress}
            style={styles.tab}
          >
            <View style={[styles.iconPill, focused && styles.iconPillFocused]}>
              {options.tabBarIcon?.({ focused, color: colors.ink, size: 24 })}
              {options.tabBarBadge !== undefined && (
                <View style={styles.badge}>
                  <Text variant="caption" color="card" style={styles.badgeText}>
                    {options.tabBarBadge}
                  </Text>
                </View>
              )}
            </View>
            <Text
              variant="caption"
              color={focused ? 'ink' : 'inkMuted'}
              style={focused && styles.labelFocused}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: space[2],
    paddingTop: space[2],
    paddingHorizontal: space[4],
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    boxShadow: shadow.softUp,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, minHeight: 56 },
  iconPill: {
    width: 56,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  iconPillFocused: { backgroundColor: colors.grape },
  badge: {
    position: 'absolute',
    top: -2,
    right: space[2],
    minWidth: 18,
    height: 18,
    paddingHorizontal: space[1],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.grapeDeep,
  },
  badgeText: { fontFamily: fontFamily.extraBold },
  labelFocused: { fontFamily: fontFamily.bold },
});
