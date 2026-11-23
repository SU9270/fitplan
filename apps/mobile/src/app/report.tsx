import { Redirect, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Card, CardHeader, Tile } from '../components/card';
import { Title, type } from '../components/display';
import { ErrorText, PrimaryButton, TextButton } from '../components/form';
import { LanguageSwitch } from '../components/language-switch';
import { MacroTiles } from '../components/macro-tiles';
import { ReasonList } from '../components/reason-list';
import { Screen } from '../components/screen';
import { Perforation, Ticket, TicketSection } from '../components/ticket';
import { useLocale, type MessageKey } from '../i18n';
import { useGate } from '../lib/gate';
import { useOnboarding } from '../onboarding/draft';
import { useSubmitProfile } from '../onboarding/use-submit';
import { tokens } from '../theme/tokens';

/**
 * Body report from the server's result for the questionnaire:
 * saved (200) → "开始使用"; needs confirmation (409) → "我已了解，继续" re-submits with `confirmed`;
 * blocked (422) → reasons and "返回修改", never today. When the user is editing answers from
 * Today, the saved button reads "回到今日"; `refreshProfile` reloads the new targets either way.
 */
export default function Report() {
  const { t } = useLocale();
  const { submission } = useOnboarding();
  const { refreshProfile, editing } = useGate();
  const { submit, busy, error } = useSubmitProfile();

  if (!submission) return <Redirect href="/goal" />;

  const { status, result } = submission;
  const { targets } = result;

  async function confirm() {
    const saved = await submit({ confirmed: true });
    // The user has just read the numbers and the reasons; saving them is the end of onboarding.
    if (saved?.status === 'saved') refreshProfile();
  }

  const reasonsTitle: MessageKey =
    status === 'blocked' ? 'report.reasons.blocked' : status === 'confirm' ? 'report.reasons.confirm' : 'report.reasons.note';

  return (
    <Screen>
      <View style={styles.topRow}>
        <View style={styles.title}>
          <Title size="display">{t('report.title')}</Title>
        </View>
        <LanguageSwitch />
      </View>
      {status !== 'blocked' ? <Text style={styles.subtitle}>{t('report.subtitle')}</Text> : null}

      {result.reasons.length > 0 ? (
        <Card tone="warning">
          <CardHeader strong label={t(reasonsTitle)} />
          <Tile>
            <ReasonList reasons={result.reasons} />
          </Tile>
        </Card>
      ) : null}

      {status !== 'blocked' && targets ? (
        <>
          <Card>
            <Stat label={t('report.bmi')} value={String(result.bmi)} />
            <Stat label={t('report.bmr')} hint={t('report.bmr.hint')} value={t('report.kcal', { n: result.bmrKcal })} />
            <Stat label={t('report.tdee')} hint={t('report.tdee.hint')} value={t('report.kcal', { n: result.tdeeKcal })} />
          </Card>
          {/* The result the questionnaire hands over: a ticket, like the estimate on the steps before. */}
          <Ticket>
            <TicketSection style={styles.targetTop}>
              <Text style={styles.targetLabel}>{t('report.target')}</Text>
              <Text style={[type.num, styles.targetValue]} accessibilityLabel={t('report.kcal', { n: targets.kcal })}>
                {targets.kcal}
                <Text style={styles.targetUnit}> {t('diary.kcalUnit')}</Text>
              </Text>
            </TicketSection>
            <Perforation notch={tokens.color.background} />
            <TicketSection style={styles.targetBottom}>
              <MacroTiles tone="paper" targets={targets} />
            </TicketSection>
          </Ticket>
        </>
      ) : null}

      <Text style={styles.disclaimer}>{t('onboarding.disclaimer')}</Text>
      <ErrorText message={error && t(error)} />

      <View style={styles.actions}>
        {status === 'saved' ? (
          <PrimaryButton title={t(editing ? 'report.backToToday' : 'report.start')} onPress={refreshProfile} />
        ) : status === 'confirm' ? (
          <>
            <PrimaryButton title={t('report.confirm')} busy={busy} onPress={() => void confirm()} />
            <TextButton tone="quiet" title={t('report.edit')} disabled={busy} onPress={() => router.back()} />
          </>
        ) : (
          <PrimaryButton title={t('report.edit')} onPress={() => router.back()} />
        )}
      </View>
    </Screen>
  );
}

function Stat({ label, hint, value }: { label: string; hint?: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label} ${value}`} style={styles.stat}>
      <View style={styles.statText}>
        <Text style={styles.statLabel}>{label}</Text>
        {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
      </View>
      <Text style={[type.num, styles.statValue]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
  },
  targetTop: {
    paddingTop: tokens.space.lg,
    gap: tokens.space.xs,
  },
  targetLabel: {
    color: tokens.color.onPaperSecondary,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.bold,
  },
  targetValue: {
    color: tokens.color.onPaper,
    fontSize: tokens.fontSize.hero,
    lineHeight: tokens.fontSize.hero * 1.15,
  },
  targetUnit: {
    color: tokens.color.onPaperSecondary,
    fontSize: tokens.fontSize.body,
  },
  // The tiles reach the card padding, like tiles in a dark card.
  targetBottom: {
    paddingHorizontal: tokens.card.padding,
    paddingBottom: tokens.space.lg,
  },
  subtitle: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.label + 1,
    lineHeight: (tokens.fontSize.label + 1) * 1.45,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.md,
    paddingHorizontal: tokens.card.tilePaddingX,
    paddingVertical: tokens.card.tilePaddingY,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
  },
  statText: {
    flex: 1,
    gap: tokens.hairline,
  },
  statLabel: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.medium,
  },
  statHint: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
  statValue: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.subtitle,
  },
  disclaimer: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
    textAlign: 'center',
  },
  actions: {
    gap: tokens.space.sm,
  },
});
