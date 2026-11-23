import { StyleSheet, Text, View } from 'react-native';
import { useLocale } from '../i18n';
import type { Preview } from '../onboarding/preview';
import { tokens } from '../theme/tokens';
import { type } from './display';
import { MacroTiles } from './macro-tiles';
import { ReasonList } from './reason-list';
import { Perforation, Ticket, TicketSection } from './ticket';

/**
 * Live local estimate shown at the bottom of each step once the basics are filled in: a paper
 * ticket with the daily kcal on top and, under the tear line, the macros and any notes.
 */
export function PreviewStrip({ preview }: { preview: Preview | null }) {
  const { t } = useLocale();
  if (preview === null) return null;

  const { result, hasTargets } = preview;
  const blocked = result.status === 'blocked';
  const targets = !blocked && hasTargets ? result.targets : null;

  return (
    <Ticket accessibilityLabel={t('preview.title')}>
      <TicketSection style={styles.top}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('preview.title')}</Text>
          <Text style={[type.num, styles.bmi]}>{t('preview.bmi', { bmi: result.bmi })}</Text>
        </View>
        {blocked ? (
          <>
            <Text style={styles.blocked}>{t('preview.blocked')}</Text>
            <ReasonList tone="paper" reasons={result.reasons} />
          </>
        ) : targets ? (
          <Text style={[type.num, styles.kcal]} accessibilityLabel={t('report.kcal', { n: targets.kcal })}>
            {targets.kcal}
            <Text style={styles.kcalUnit}> {t('diary.kcalUnit')}</Text>
          </Text>
        ) : (
          <Text style={styles.footnote}>{t('preview.needActivity')}</Text>
        )}
      </TicketSection>
      {targets ? (
        <>
          <Perforation notch={tokens.color.background} />
          <TicketSection style={styles.bottom}>
            <View style={styles.tiles}>
              <MacroTiles tone="paper" targets={targets} />
            </View>
            <ReasonList tone="paper" reasons={result.reasons} />
            <Text style={styles.footnote}>{t('preview.estimate')}</Text>
          </TicketSection>
        </>
      ) : null}
    </Ticket>
  );
}

const styles = StyleSheet.create({
  top: {
    paddingTop: tokens.space.lg,
    gap: tokens.space.xs,
  },
  bottom: {
    paddingBottom: tokens.space.lg,
    gap: tokens.space.md,
  },
  // The tiles reach the card padding, like tiles in a dark card; the text keeps the header inset.
  tiles: {
    marginHorizontal: -tokens.card.headerInset,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: tokens.color.onPaperSecondary,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.bold,
  },
  bmi: {
    color: tokens.color.onPaperSecondary,
    fontSize: tokens.fontSize.caption,
  },
  kcal: {
    color: tokens.color.onPaper,
    fontSize: tokens.fontSize.hero,
    lineHeight: tokens.fontSize.hero * 1.15,
  },
  kcalUnit: {
    color: tokens.color.onPaperSecondary,
    fontSize: tokens.fontSize.body,
  },
  blocked: {
    color: tokens.color.onPaper,
    fontSize: tokens.fontSize.body,
    fontWeight: tokens.fontWeight.bold,
  },
  footnote: {
    color: tokens.color.onPaperSecondary,
    fontSize: tokens.fontSize.caption,
    lineHeight: tokens.fontSize.caption * 1.4,
  },
});
