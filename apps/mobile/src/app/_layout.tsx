import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GateProvider, useGate } from '../lib/gate';
import { tokens } from '../theme/tokens';

void SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  // Denied routes fall back to `index`, which redirects to wherever the gate says.
  anchor: 'index',
};

/**
 * Route guard (protected routes, as in the Expo Router authentication guide):
 * signed out → (auth); signed in without a goal → (onboarding); with a goal → today.
 * `index` stays reachable and redirects, so a guard flip (sign-in, sign-out, goal saved)
 * always lands on the right screen.
 */
function RootNavigator() {
  const { status } = useGate();

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hide();
  }, [status]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.color.background } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'needsGoal'}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'ready'}>
        <Stack.Screen name="today" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GateProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </GateProvider>
    </SafeAreaProvider>
  );
}
