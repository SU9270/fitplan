import { StyleSheet, Text, View } from 'react-native';
import { useLocale } from '../i18n';
import type { Preview } from '../onboarding/preview';
import { tokens } from '../theme/tokens';
import { MacroTiles } from './macro-tiles';
import { ReasonList } from './reason-list';

/** Live local estimate shown at the bottom of each step once the basics are filled in. */
export function PreviewStrip({ preview }: { preview: Preview | null }) {
  const { t } = useLocale();
  if (preview === null) return null;

  const { result, hasTargets } = preview;
  const blocked = result.status === 'blocked';

  return (
    <View accessibilityLabel={t('preview.title')} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('preview.title')}</Text>
        <Text style={styles.bmi}>{t('preview.bmi', { bmi: result.bmi })}</Text>
      </View>
      {blocked ? (
        <>
          <Text style={styles.blocked}>{t('preview.blocked')}</Text>
          <ReasonList reasons={result.reasons} />
        </>
      ) : hasTargets && result.targets ? (
        <>
          <Text style={styles.kcal}>{t('report.kcal', { n: result.targets.kcal })}</Text>
          <MacroTiles targets={result.targets} />
          <ReasonList reasons={result.reasons} />
          <Text style={styles.footnote}>{t('preview.estimate')}</Text>
        </>
      ) : (
        <Text style={styles.footnote}>{t('preview.needActivity')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.card.gap,
    padding: tokens.card.padding,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.card,
  },
  header: {
    paddingHorizontal: tokens.card.headerInset,
    paddingTop: tokens.card.headerInset,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.medium,
  },
  bmi: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
  kcal: {
    paddingHorizontal: tokens.card.headerInset,
    color: tokens.color.text,
    fontSize: tokens.fontSize.display,
    fontWeight: tokens.fontWeight.medium,
  },
  blocked: {
    paddingHorizontal: tokens.card.headerInset,
    color: tokens.color.text,
    fontSize: tokens.fontSize.body,
    fontWeight: tokens.fontWeight.semibold,
  },
  footnote: {
    paddingHorizontal: tokens.card.headerInset,
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
});
