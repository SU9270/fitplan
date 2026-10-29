import type { HealthFlags } from '@fitplan/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckRow } from '../../components/check-row';
import { ErrorText } from '../../components/form';
import { StepLayout } from '../../components/step-layout';
import { useLocale } from '../../i18n';
import { useOnboarding } from '../../onboarding/draft';
import { computePreview } from '../../onboarding/preview';
import { useSubmitProfile } from '../../onboarding/use-submit';
import { tokens } from '../../theme/tokens';

const HEALTH_FLAGS = ['pregnantOrNursing', 'eatingDisorderHistory', 'medicalDiet'] as const satisfies readonly (keyof HealthFlags)[];

export default function Health() {
  const { t } = useLocale();
  const { draft, updateDraft } = useOnboarding();
  const { submit, busy, error } = useSubmitProfile();
  const [attempted, setAttempted] = useState(false);

  async function next() {
    setAttempted(true);
    if (!draft.consent) return;
    const submission = await submit();
    if (submission) router.push('/report');
  }

  return (
    <StepLayout
      step={4}
      title={t('onboarding.health.title')}
      subtitle={t('onboarding.health.subtitle')}
      preview={computePreview(draft)}
      onBack={() => router.back()}
      onNext={() => void next()}
      nextTitle={t('onboarding.health.submit')}
      nextBusy={busy}
    >
      <View style={styles.group}>
        {HEALTH_FLAGS.map((flag) => (
          <CheckRow
            key={flag}
            label={t(`onboarding.health.${flag}`)}
            checked={draft.healthFlags[flag]}
            onChange={(checked) => updateDraft((d) => ({ ...d, healthFlags: { ...d.healthFlags, [flag]: checked } }))}
          />
        ))}
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>{t('onboarding.consent.title')}</Text>
        <CheckRow
          label={t('onboarding.consent.label')}
          checked={draft.consent}
          onChange={(consent) => updateDraft((d) => ({ ...d, consent }))}
        />
        <ErrorText message={attempted && !draft.consent ? t('onboarding.consent.required') : null} />
      </View>
      <ErrorText message={error && t(error)} />
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: tokens.space.xs,
  },
  label: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.semibold,
  },
});
