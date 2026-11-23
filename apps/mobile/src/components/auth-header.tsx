import { StyleSheet, Text, View } from 'react-native';
import { useLocale } from '../i18n';
import { tokens } from '../theme/tokens';
import { Title, type } from './display';
import { LanguageSwitch } from './language-switch';

/**
 * Top of the sign-in and sign-up screens: the brand and the language switch on one row, then a
 * yellow banner with the screen's title. The banner and the submit button are the screen's two
 * yellow blocks, so the eye goes title → fields → button.
 */
export function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const { t } = useLocale();
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={[type.num, styles.brand]}>{t('app.name').toUpperCase()}</Text>
        <LanguageSwitch />
      </View>
      <View style={styles.banner}>
        <Title color={tokens.color.onPrimary}>{title}</Title>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
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
    // The brand starts, and the language switch ends, on the banner's text inset (the switch brings its own padding).
    paddingLeft: tokens.card.padding + tokens.card.headerInset,
    paddingRight: tokens.card.padding + tokens.card.headerInset - tokens.space.sm,
  },
  brand: {
    color: tokens.color.primary,
    fontSize: tokens.fontSize.subtitle,
    letterSpacing: 1,
  },
  banner: {
    minHeight: 216,
    justifyContent: 'flex-end',
    gap: tokens.space.xs,
    paddingHorizontal: tokens.card.padding + tokens.card.headerInset,
    paddingVertical: tokens.space.xl,
    overflow: 'hidden',
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.primary,
  },
  subtitle: {
    color: tokens.color.onPrimarySecondary,
    fontSize: tokens.fontSize.body,
    fontWeight: tokens.fontWeight.medium,
  },
});
