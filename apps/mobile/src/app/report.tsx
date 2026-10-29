import { Redirect, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/card';
import { ErrorText, PrimaryButton, TextButton } from '../components/form';
import { LanguageSwitch } from '../components/language-switch';
import { MacroTiles } from '../components/macro-tiles';
import { ReasonList } from '../components/reason-list';
import { Screen } from '../components/screen';
import { useLocale, type MessageKey } from '../i18n';
import { useGate } from '../lib/gate';
import { useOnboarding } from '../onboarding/draft';
import { useSubmitProfile } from '../onboarding/use-submit';
import { tokens } from '../theme/tokens';

/**
 * Body report from the server's result for the questionnaire:
 * saved (200) → "开始使用"; needs confirmation (409) → "我已了解，继续" re-submits with `confirmed`;
 * blocked (422) → reasons and "返回修改", never today.
 */
export default function Report() {
  const { t } = useLocale();
  const { submission } = useOnboarding();
  const { refreshProfile } = useGate();
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
        <Text accessibilityRole="header" style={styles.title}>
          {t('report.title')}
        </Text>
        <LanguageSwitch />
      </View>
      {status !== 'blocked' ? <Text style={styles.subtitle}>{t('report.subtitle')}</Text> : null}

      {result.reasons.length > 0 ? (
        <Card tone="warning">
          <Text accessibilityRole="header" style={styles.cardTitle}>
            {t(reasonsTitle)}
          </Text>
          <ReasonList reasons={result.reasons} />
        </Card>
      ) : null}

      {status !== 'blocked' && targets ? (
        <>
          <Card>
            <Stat label={t('report.bmi')} value={String(result.bmi)} />
            <Stat label={t('report.bmr')} hint={t('report.bmr.hint')} value={t('report.kcal', { n: result.bmrKcal })} />
            <Stat label={t('report.tdee')} hint={t('report.tdee.hint')} value={t('report.kcal', { n: result.tdeeKcal })} />
          </Card>
          <Card>
            <Text style={styles.cardTitle}>{t('report.target')}</Text>
            <Text style={styles.kcal}>{t('report.kcal', { n: targets.kcal })}</Text>
            <MacroTiles targets={targets} />
          </Card>
        </>
      ) : null}

      <Text style={styles.disclaimer}>{t('onboarding.disclaimer')}</Text>
      <ErrorText message={error && t(error)} />

      <View style={styles.actions}>
        {status === 'saved' ? (
          <PrimaryButton title={t('report.start')} onPress={refreshProfile} />
        ) : status === 'confirm' ? (
          <>
            <PrimaryButton title={t('report.confirm')} busy={busy} onPress={() => void confirm()} />
            <TextButton title={t('report.edit')} disabled={busy} onPress={() => router.back()} />
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
      <Text style={styles.statValue}>{value}</Text>
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
    color: tokens.color.text,
    fontSize: tokens.fontSize.title,
    fontWeight: tokens.fontWeight.bold,
  },
  subtitle: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.body,
  },
  cardTitle: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.body,
    fontWeight: tokens.fontWeight.semibold,
  },
  kcal: {
    color: tokens.color.primary,
    fontSize: tokens.fontSize.display,
    fontWeight: tokens.fontWeight.bold,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.md,
  },
  statText: {
    flex: 1,
    gap: tokens.space.xs,
  },
  statLabel: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.body,
    fontWeight: tokens.fontWeight.medium,
  },
  statHint: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
  statValue: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.subtitle,
    fontWeight: tokens.fontWeight.bold,
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
