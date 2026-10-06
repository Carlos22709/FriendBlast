import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

type IconName = ComponentProps<typeof Ionicons>['name'];

type TabIconProps = {
  activeName: IconName;
  color: ColorValue;
  focused: boolean;
  name: IconName;
  size: number;
};

export function TabIcon({ activeName, color, focused, name, size }: TabIconProps) {
  return <Ionicons color={color as string} name={focused ? activeName : name} size={size} />;
}
