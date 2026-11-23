import { FugazOne_400Regular } from '@expo-google-fonts/fugaz-one';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GateProvider, useGate } from '../lib/gate';
import { routeAccess } from '../lib/route-access';
import { OnboardingProvider } from '../onboarding/draft';
import { tokens } from '../theme/tokens';

void SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  // Denied routes fall back to `index`, which redirects to wherever the gate says.
  anchor: 'index',
};

/**
 * Route guard (protected routes, as in the Expo Router authentication guide):
 * signed out → (auth); signed in without a goal → (onboarding); with a goal → the (tabs) Today
 * and Me (and the food / entry screens on top of them), plus
 * (onboarding) while the user edits their answers (see `routeAccess`).
 * `index` stays reachable and redirects, so a guard flip (sign-in, sign-out, goal saved)
 * always lands on the right screen.
 */
function RootNavigator() {
  const { status, editing } = useGate();
  const access = routeAccess(status, editing);
  // The number / title font. If it cannot be loaded the app still opens, in the system font.
  const [fontsLoaded, fontError] = useFonts({ FugazOne_400Regular });
  const fontsSettled = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (status !== 'loading' && fontsSettled) SplashScreen.hide();
  }, [status, fontsSettled]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.color.background } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={access.auth}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={access.onboarding}>
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="report" />
      </Stack.Protected>
      <Stack.Protected guard={access.today}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="food" />
        <Stack.Screen name="entry" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GateProvider>
        <StatusBar style="light" />
        {/* Above the navigator: the questionnaire draft survives a 401 sign-out and sign-in. */}
        <OnboardingProvider>
          <RootNavigator />
        </OnboardingProvider>
      </GateProvider>
    </SafeAreaProvider>
  );
}
