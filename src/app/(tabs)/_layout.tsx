import { Tabs } from 'expo-router';

import { TabIcon } from '@/presentation/components/TabIcon';
import { colors } from '@/presentation/theme/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="(feed)"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon
              activeName="home"
              color={color}
              focused={focused}
              name="home-outline"
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="(explore)"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon
              activeName="search"
              color={color}
              focused={focused}
              name="search-outline"
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="(activity)"
        options={{
          title: 'Actividad',
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon
              activeName="heart"
              color={color}
              focused={focused}
              name="heart-outline"
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon
              activeName="person"
              color={color}
              focused={focused}
              name="person-outline"
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
