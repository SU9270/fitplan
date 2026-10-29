import { StyleSheet, Text, View } from 'react-native';
import { useLocale } from '../i18n';
import { tokens } from '../theme/tokens';
import { LanguageSwitch } from './language-switch';

export function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const { t } = useLocale();
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.brand}>{t('app.name')}</Text>
        <LanguageSwitch />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.space.sm,
    marginBottom: tokens.space.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    color: tokens.color.primary,
    fontSize: tokens.fontSize.subtitle,
    fontWeight: tokens.fontWeight.bold,
  },
  title: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.display,
    fontWeight: tokens.fontWeight.bold,
  },
  subtitle: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.body,
  },
});
