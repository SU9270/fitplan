import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '../../i18n';
import { tokens } from '../../theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** The current tab's icon sits in a yellow pill; the others are plain gray. */
function tabIcon(focused: IconName, idle: IconName) {
  return ({ focused: isFocused }: { focused: boolean }) => (
    <View style={[styles.pill, isFocused && styles.pillFocused]}>
      <Ionicons
        name={isFocused ? focused : idle}
        color={isFocused ? tokens.color.onPrimary : tokens.color.textTertiary}
        size={ICON_SIZE}
      />
    </View>
  );
}

/** Bottom tab bar: Today (the food diary), the food library, and Me (profile and settings). */
export default function TabsLayout() {
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.color.primary,
        tabBarInactiveTintColor: tokens.color.textTertiary,
        tabBarStyle: [styles.bar, { height: BAR_HEIGHT + insets.bottom }],
        tabBarIconStyle: styles.icon,
        tabBarLabelStyle: styles.label,
        sceneStyle: { backgroundColor: tokens.color.background },
      }}
    >
      <Tabs.Screen name="today" options={{ title: t('tabs.today'), tabBarIcon: tabIcon('today', 'today-outline') }} />
      <Tabs.Screen
        name="library"
        options={{ title: t('tabs.library'), tabBarIcon: tabIcon('grid', 'grid-outline') }}
      />
      <Tabs.Screen name="me" options={{ title: t('tabs.me'), tabBarIcon: tabIcon('person', 'person-outline') }} />
    </Tabs>
  );
}

const ICON_SIZE = 20;
const PILL_WIDTH = 56;
const PILL_HEIGHT = 32;
/** Pill + label + the space around them, above the home indicator. */
const BAR_HEIGHT = 64;

const styles = StyleSheet.create({
  bar: {
    paddingTop: tokens.space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.color.cardBorder,
    backgroundColor: tokens.color.background,
  },
  icon: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
  },
  pill: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: PILL_HEIGHT / 2,
  },
  pillFocused: {
    backgroundColor: tokens.color.primary,
  },
  label: {
    marginTop: tokens.space.xs,
    fontSize: tokens.fontSize.micro,
    fontWeight: tokens.fontWeight.bold,
  },
});
