import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { TextButton } from '../../components/form';
import { OptionCard, OptionGroup } from '../../components/option-card';
import { SegmentedControl } from '../../components/segmented-control';
import { StepLayout } from '../../components/step-layout';
import { useLocale } from '../../i18n';
import { useGate } from '../../lib/gate';
import { useSignOut } from '../../lib/use-sign-out';
import { useOnboarding } from '../../onboarding/draft';
import { paceDescription } from '../../onboarding/pace';
import { computePreview } from '../../onboarding/preview';
import { tokens } from '../../theme/tokens';

const PACES = ['conservative', 'standard', 'aggressive'] as const;

export default function Goal() {
  const { t } = useLocale();
  const { draft, updateDraft, hydrated } = useOnboarding();
  const signOut = useSignOut();
  // Editing from Today: offer a way back instead of signing out.
  const { editing } = useGate();

  if (!hydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={tokens.color.primary} accessibilityLabel={t('gate.loading')} />
      </View>
    );
  }

  const description = paceDescription(draft.goal, draft.pace);

  return (
    <StepLayout
      step={1}
      title={t('onboarding.goal.title')}
      subtitle={t('onboarding.goal.subtitle')}
      preview={computePreview(draft)}
      onNext={() => router.push('/basics')}
      footer={
        editing ? (
          <TextButton title={t('onboarding.cancelEdit')} onPress={() => router.back()} />
        ) : (
          <TextButton title={t('auth.signOut')} onPress={() => void signOut()} />
        )
      }
    >
      <OptionGroup label={t('onboarding.goal.title')}>
        <OptionCard
          title={t('onboarding.goal.lose.title')}
          description={t('onboarding.goal.lose.desc')}
          selected={draft.goal === 'lose'}
          onPress={() => updateDraft((d) => ({ ...d, goal: 'lose' }))}
        />
        <OptionCard
          title={t('onboarding.goal.gain.title')}
          description={t('onboarding.goal.gain.desc')}
          selected={draft.goal === 'gain'}
          onPress={() => updateDraft((d) => ({ ...d, goal: 'gain' }))}
        />
      </OptionGroup>

      <View style={styles.pace}>
        <Text style={styles.label}>{t('onboarding.pace.label')}</Text>
        <SegmentedControl
          label={t('onboarding.pace.label')}
          value={draft.pace}
          options={PACES.map((pace) => ({ value: pace, label: t(`onboarding.pace.${pace}`) }))}
          onChange={(pace) => updateDraft((d) => ({ ...d, pace }))}
        />
        <Text style={styles.paceHint}>{t(description.key, description.params)}</Text>
      </View>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.background,
  },
  pace: {
    gap: tokens.space.sm,
  },
  label: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.semibold,
  },
  paceHint: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.body,
  },
});
