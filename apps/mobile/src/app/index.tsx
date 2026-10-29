import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, TextButton } from '../components/form';
import { useLocale } from '../i18n';
import { authClient } from '../lib/auth-client';
import { useGate } from '../lib/gate';
import { tokens } from '../theme/tokens';

/** Entry route: redirects according to the gate, or shows loading / a retryable error. */
export default function Index() {
  const { status, refreshProfile } = useGate();
  const { t } = useLocale();

  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  if (status === 'needsGoal') return <Redirect href="/goal" />;
  if (status === 'ready') return <Redirect href="/today" />;

  return (
    <View style={styles.container}>
      {status === 'loading' ? (
        <>
          <ActivityIndicator color={tokens.color.primary} accessibilityLabel={t('gate.loading')} />
          <Text style={styles.text}>{t('gate.loading')}</Text>
        </>
      ) : (
        <>
          <Text accessibilityRole="header" style={styles.title}>
            {t('gate.error.title')}
          </Text>
          <PrimaryButton title={t('gate.error.retry')} onPress={refreshProfile} />
          <TextButton title={t('auth.signOut')} onPress={() => void authClient.signOut()} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: tokens.space.lg,
    padding: tokens.space.xl,
    backgroundColor: tokens.color.background,
  },
  text: {
    textAlign: 'center',
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.body,
  },
  title: {
    textAlign: 'center',
    color: tokens.color.text,
    fontSize: tokens.fontSize.subtitle,
    fontWeight: tokens.fontWeight.semibold,
  },
});
