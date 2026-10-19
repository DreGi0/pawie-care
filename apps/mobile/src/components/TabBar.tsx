import type { BottomTabBarProps } from 'expo-router/tabs';
import { StyleSheet, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { colors, fontFamily, shadow, space } from '@/theme/tokens';

import { Text } from './Text';
import { Touchable } from './Touchable';

const BAR_HEIGHT = 68;
const PILL = { width: 56, height: 32 };

/**
 * The `tabBar` of expo-router's Tabs: a bar that floats over the bottom edge, with a pill
 * that grows behind the icon of the current tab. Each screen sets `title`, `tabBarIcon` and,
 * to show a count, `tabBarBadge` and `tabBarAccessibilityLabel` (such as "Visitas, 1
 * pendiente de pago").
 */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, space[3]) }]}>
      <View accessibilityRole="tablist" style={styles.bar}>
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
            <Touchable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              pressedScale={0.92}
              style={styles.tab}
            >
              <View style={styles.iconBox}>
                <Animated.View
                  style={[
                    styles.pill,
                    { opacity: focused ? 1 : 0, transform: [{ scaleX: focused ? 1 : 0.4 }] },
                    transitions.pill,
                  ]}
                />
                <View>{options.tabBarIcon?.({ focused, color: colors.ink, size: 24 })}</View>
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
            </Touchable>
          );
        })}
      </View>
    </View>
  );
}

const transitions = css.create({
  pill: {
    transitionProperty: ['opacity', 'transform'],
    transitionDuration: 220,
    transitionTimingFunction: 'ease-out',
  },
});

// The radii are exactly half of each height instead of radius.pill, so no platform has to
// clamp an oversized radius.
const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: space[4], paddingTop: space[2] },
  bar: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[2],
    backgroundColor: colors.card,
    borderRadius: BAR_HEIGHT / 2,
    boxShadow: shadow.soft,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, height: BAR_HEIGHT },
  iconBox: { ...PILL, alignItems: 'center', justifyContent: 'center' },
  pill: {
    ...StyleSheet.absoluteFill,
    borderRadius: PILL.height / 2,
    backgroundColor: colors.grape,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: space[2],
    minWidth: 18,
    height: 18,
    paddingHorizontal: space[1],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: colors.grapeDeep,
  },
  badgeText: { fontFamily: fontFamily.extraBold },
  labelFocused: { fontFamily: fontFamily.bold },
});
