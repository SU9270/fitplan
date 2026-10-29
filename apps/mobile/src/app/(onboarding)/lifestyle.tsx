import type { ActivityLevel } from '@fitplan/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ErrorText } from '../../components/form';
import { OptionCard, OptionGroup } from '../../components/option-card';
import { ChipRow } from '../../components/segmented-control';
import { StepLayout } from '../../components/step-layout';
import { useLocale } from '../../i18n';
import { useOnboarding } from '../../onboarding/draft';
import type { TrainingExperience } from '../../onboarding/draft-model';
import { computePreview } from '../../onboarding/preview';
import { hasErrors, lifestyleErrors } from '../../onboarding/validation';
import { tokens } from '../../theme/tokens';

const ACTIVITY_LEVELS = [1, 2, 3, 4, 5] as const satisfies readonly ActivityLevel[];
const EXPERIENCES = ['beginner', 'intermediate', 'advanced'] as const satisfies readonly TrainingExperience[];
const TRAINING_DAYS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export default function Lifestyle() {
  const { t } = useLocale();
  const { draft, updateDraft } = useOnboarding();
  const [attempted, setAttempted] = useState(false);

  const errors = lifestyleErrors(draft);
  const show = (key: keyof typeof errors) => {
    const message = attempted ? errors[key] : undefined;
    return message ? t(message) : null;
  };

  function next() {
    setAttempted(true);
    if (!hasErrors(errors)) router.push('/health');
  }

  return (
    <StepLayout
      step={3}
      title={t('onboarding.lifestyle.title')}
      subtitle={t('onboarding.lifestyle.subtitle')}
      preview={computePreview(draft)}
      onBack={() => router.back()}
      onNext={next}
    >
      <View style={styles.group}>
        <Text style={styles.label}>{t('onboarding.activity.label')}</Text>
        <OptionGroup label={t('onboarding.activity.label')}>
          {ACTIVITY_LEVELS.map((level) => (
            <OptionCard
              key={level}
              title={t(`onboarding.activity.${level}.title`)}
              description={t(`onboarding.activity.${level}.desc`)}
              selected={draft.activityLevel === level}
              onPress={() => updateDraft((d) => ({ ...d, activityLevel: level }))}
            />
          ))}
        </OptionGroup>
        <ErrorText message={show('activity')} />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>{t('onboarding.days.label')}</Text>
        <ChipRow
          label={t('onboarding.days.label')}
          value={draft.trainingDaysPerWeek}
          options={TRAINING_DAYS.map((n) => ({
            value: n,
            label: String(n),
            accessibilityLabel: t('onboarding.days.option', { n }),
          }))}
          onChange={(n) => updateDraft((d) => ({ ...d, trainingDaysPerWeek: n }))}
        />
        <ErrorText message={show('days')} />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>{t('onboarding.experience.label')}</Text>
        <OptionGroup label={t('onboarding.experience.label')}>
          {EXPERIENCES.map((experience) => (
            <OptionCard
              key={experience}
              title={t(`onboarding.experience.${experience}.title`)}
              description={t(`onboarding.experience.${experience}.desc`)}
              selected={draft.trainingExperience === experience}
              onPress={() => updateDraft((d) => ({ ...d, trainingExperience: experience }))}
            />
          ))}
        </OptionGroup>
        <ErrorText message={show('experience')} />
      </View>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: tokens.space.sm,
  },
  label: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.semibold,
  },
});
