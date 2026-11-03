import type { CaregiverLevel, ServiceCode } from '@pawie/api-client';
import { StyleSheet, View } from 'react-native';

import { serviceShortName } from '@/lib/bookings';
import { LEVEL_NAMES, levelLabel } from '@/lib/caregivers';
import { services } from '@/theme/services';
import { borderWidth, colors, radius, space, type ColorName } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Kind =
  /** Verified by Pawie (RN-CUI-03, RN-CUI-05): white, with an ink border and its icon. */
  | { kind: 'badge'; label: string; icon: IconName }
  | { kind: 'certification'; label: string }
  /** The special care certification, the only use of `star`. */
  | { kind: 'star'; label: string }
  /** RN-NIV-01. The Súper Cuidador's is the only one in `primary`. */
  | { kind: 'level'; level: CaregiverLevel }
  | { kind: 'service'; service: ServiceCode };

export type TagProps = Kind & {
  /** `sm` is for lists. */
  size?: 'md' | 'sm';
  /** In a two-column grid the label may take two lines. */
  wrap?: boolean;
};

/**
 * A placa: a collar tag with a hole on the left. It shows what Pawie verified, the level, the
 * certifications and the service. A booking's state is not a placa: see Status.
 */
export function Tag({ size = 'md', wrap = false, ...props }: TagProps) {
  const { background, text, label, icon, a11y } = look(props);

  return (
    <View
      accessible
      accessibilityLabel={a11y ?? label}
      style={[
        styles.tag,
        size === 'sm' && styles.small,
        wrap && styles.wrap,
        { backgroundColor: colors[background] },
        props.kind === 'badge' && styles.outlined,
      ]}
    >
      <View style={[styles.hole, props.kind === 'badge' && styles.holeOutlined]} />
      {icon && <Icon name={icon} size={16} color={text} filled={props.kind === 'star'} />}
      <Text
        variant="placa"
        color={text}
        style={[size === 'sm' && styles.smallText, wrap && styles.flex]}
        numberOfLines={wrap ? 2 : 1}
      >
        {label}
      </Text>
    </View>
  );
}

function look(props: Kind): {
  background: ColorName;
  text: ColorName;
  label: string;
  icon?: IconName;
  a11y?: string;
} {
  switch (props.kind) {
    case 'badge':
      return { background: 'white', text: 'ink', label: props.label, icon: props.icon };
    case 'certification':
      return { background: 'tint', text: 'ink', label: props.label };
    case 'star':
      return { background: 'star', text: 'ink', label: props.label, icon: 'star' };
    case 'level':
      return {
        background: props.level === 'SUPER' ? 'primary' : 'tint',
        text: props.level === 'SUPER' ? 'white' : 'ink',
        label: LEVEL_NAMES[props.level],
        a11y: levelLabel(props.level),
      };
    case 'service':
      return {
        background: services[props.service].color,
        text: 'ink',
        label: serviceShortName(props.service),
      };
  }
}

/** The ⭐ on its own, in lists: a round medal with no hole. */
export function StarMedal() {
  return (
    <View
      accessible
      accessibilityLabel="Con certificación de cuidado especial"
      style={styles.medal}
    >
      <Icon name="star" size={16} filled />
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 32,
    paddingLeft: 9,
    paddingRight: 13,
    borderRadius: radius.md,
  },
  small: { height: 28, gap: 6, paddingLeft: 8, paddingRight: 11, borderRadius: 14 },
  smallText: { fontSize: 13, lineHeight: 16 },
  wrap: {
    alignSelf: 'stretch',
    height: 'auto',
    minHeight: 48,
    paddingVertical: space[2],
    paddingLeft: 10,
    paddingRight: space[3],
  },
  outlined: { borderWidth: borderWidth.hairline, borderColor: colors.ink },
  flex: { flex: 1 },
  // The hole the ring goes through: it shows the screen's background.
  hole: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.bg },
  holeOutlined: { borderWidth: borderWidth.hairline, borderColor: colors.line },
  medal: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.star,
  },
});
