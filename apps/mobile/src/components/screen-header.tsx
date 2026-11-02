import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useLocale } from '../i18n';
import { tokens } from '../theme/tokens';
import { TextButton } from './form';

/** Back button + title for screens pushed on top of Today. */
export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { t } = useLocale();
  return (
    <View style={styles.container}>
      <View style={styles.back}>
        <TextButton title={`‹ ${t('food.back')}`} accessibilityLabel={t('food.back')} onPress={() => router.back()} />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.space.xs,
  },
  back: {
    alignSelf: 'flex-start',
    marginLeft: -tokens.space.sm,
  },
  title: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.title,
    fontWeight: tokens.fontWeight.bold,
  },
  subtitle: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.body,
  },
});
