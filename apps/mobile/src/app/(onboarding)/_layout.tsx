import { Stack } from 'expo-router';
import { tokens } from '../../theme/tokens';

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.color.background } }} />;
}
