import type { ServiceCode } from '@pawie/api-client';
import { StyleSheet, View } from 'react-native';

import { serviceShortName } from '@/lib/bookings';
import { services } from '@/theme/services';
import { borderWidth, colors, radius, space } from '@/theme/tokens';

import { Icon } from './Icon';
import { Text } from './Text';
import { Touchable } from './Touchable';

export type ServiceBlockProps = {
  service: ServiceCode;
  /** One line under the name, such as "En tu casa". */
  detail: string;
  selected: boolean;
  onPress: () => void;
};

/** A big block in the service's color to choose it. The chosen one has an ink border and a check. */
export function ServiceBlock({ service, detail, selected, onPress }: ServiceBlockProps) {
  const { color, icon } = services[service];

  return (
    <Touchable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${serviceShortName(service)}, ${detail}`}
      onPress={onPress}
      style={[styles.block, { backgroundColor: colors[color] }, selected && styles.selected]}
    >
      <Icon name={icon} size={32} />
      {selected && (
        <View style={styles.tick}>
          <Icon name="check" size={16} color="white" />
        </View>
      )}
      <View>
        <Text variant="subheading" style={styles.name}>
          {serviceShortName(service)}
        </Text>
        <Text variant="footnote" color="inkMuted">
          {detail}
        </Text>
      </View>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  block: {
    flex: 1,
    height: 152,
    justifyContent: 'space-between',
    paddingTop: space[4],
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderRadius: radius.lg,
    borderWidth: borderWidth.selected,
    borderColor: 'transparent',
  },
  selected: { borderColor: colors.ink },
  tick: {
    position: 'absolute',
    top: space[3],
    right: space[3],
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.ink,
  },
  name: { fontSize: 22, lineHeight: 24, letterSpacing: -0.2 },
});
