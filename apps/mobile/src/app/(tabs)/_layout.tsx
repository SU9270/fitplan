import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useLocale } from '../../i18n';
import { tokens } from '../../theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

function tabIcon(focused: IconName, idle: IconName) {
  return ({ color, size, focused: isFocused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Ionicons name={isFocused ? focused : idle} color={color as string} size={size} />
  );
}

/** Bottom tab bar: Today (the food diary), the food library, and Me (profile and settings). */
export default function TabsLayout() {
  const { t } = useLocale();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.color.primary,
        tabBarInactiveTintColor: tokens.color.textSecondary,
        tabBarStyle: { backgroundColor: tokens.color.surface, borderTopColor: tokens.color.border },
        sceneStyle: { backgroundColor: tokens.color.background },
      }}
    >
      <Tabs.Screen name="today" options={{ title: t('tabs.today'), tabBarIcon: tabIcon('today', 'today-outline') }} />
      <Tabs.Screen
        name="library"
        options={{ title: t('tabs.library'), tabBarIcon: tabIcon('nutrition', 'nutrition-outline') }}
      />
      <Tabs.Screen name="me" options={{ title: t('tabs.me'), tabBarIcon: tabIcon('person', 'person-outline') }} />
    </Tabs>
  );
}
