import { SvgXml } from 'react-native-svg';

import { colors, type ColorName } from '@/theme/tokens';

import { icons, type IconName } from './icons.generated';

export type { IconName };

export type IconProps = {
  name: IconName;
  size?: number;
  color?: ColorName;
};

/** A Lucide icon. It's decorative: describe the action on the control that contains it. */
export function Icon({ name, size = 24, color = 'ink' }: IconProps) {
  return (
    <SvgXml
      xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${icons[name]}</svg>`}
      width={size}
      height={size}
      color={colors[color]}
      accessible={false}
    />
  );
}
