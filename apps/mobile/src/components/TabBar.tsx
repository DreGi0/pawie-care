import type { BottomTabBarProps } from 'expo-router/tabs';
import { StyleSheet, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { borderWidth, colors, fontFamily, space } from '@/theme/tokens';

import { Text } from './Text';
import { Touchable } from './Touchable';

const PILL = { width: 60, height: 30 };

/**
 * The `tabBar` of expo-router's Tabs: a bar on the bottom edge, with a `tint` pill that grows
 * behind the icon of the current tab. Each screen sets `title`, `tabBarIcon` and, to show a
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
        const color = focused ? colors.primary : colors.inkMuted;

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
              <View>{options.tabBarIcon?.({ focused, color, size: 24 })}</View>
              {options.tabBarBadge !== undefined && (
                <View style={styles.badge}>
                  <Text variant="footnote" color="white" style={styles.badgeText}>
                    {options.tabBarBadge}
                  </Text>
                </View>
              )}
            </View>
            <Text
              variant="footnote"
              color={focused ? 'primary' : 'inkMuted'}
              style={styles.label}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Touchable>
        );
      })}
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
  bar: {
    flexDirection: 'row',
    paddingTop: 6,
    paddingHorizontal: space[2],
    backgroundColor: colors.bg,
    borderTopWidth: borderWidth.hairline,
    borderTopColor: colors.line,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 56 },
  iconBox: { ...PILL, alignItems: 'center', justifyContent: 'center' },
  pill: {
    ...StyleSheet.absoluteFill,
    borderRadius: PILL.height / 2,
    backgroundColor: colors.tint,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: space[2],
    minWidth: 20,
    height: 20,
    paddingHorizontal: space[1],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  badgeText: { fontFamily: fontFamily.displayBold, lineHeight: 16 },
  label: { fontFamily: fontFamily.displaySemiBold },
});
