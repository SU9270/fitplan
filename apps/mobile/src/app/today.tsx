import { StyleSheet, Text } from 'react-native';
import { TextButton } from '../components/form';
import { Screen } from '../components/screen';
import { useLocale } from '../i18n';
import { authClient } from '../lib/auth-client';
import { tokens } from '../theme/tokens';

/** Placeholder so the route guard has a target; Task 8 replaces it. */
export default function Today() {
  const { t } = useLocale();
  return (
    <Screen centered>
      <Text accessibilityRole="header" style={styles.title}>
        {t('today.title')}
      </Text>
      <TextButton title={t('auth.signOut')} onPress={() => void authClient.signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.title,
    fontWeight: tokens.fontWeight.bold,
  },
});
