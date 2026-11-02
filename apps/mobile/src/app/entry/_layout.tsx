import { Stack } from 'expo-router';
import { tokens } from '../../theme/tokens';

/** The diary entry editor, pushed on top of Today. */
export default function EntryLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.color.background } }} />;
}
