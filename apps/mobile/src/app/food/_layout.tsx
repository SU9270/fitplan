import { Stack } from 'expo-router';
import { tokens } from '../../theme/tokens';

/** Food search, food detail and the custom food form, pushed on top of Today. */
export default function FoodLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.color.background } }} />;
}
