import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ErrorText, TextField } from '../../components/form';
import { SegmentedControl } from '../../components/segmented-control';
import { StepLayout } from '../../components/step-layout';
import { useLocale } from '../../i18n';
import { useOnboarding } from '../../onboarding/draft';
import { setHeightField, setWeightField, switchUnitSystem, type UnitSystem } from '../../onboarding/draft-model';
import { computePreview } from '../../onboarding/preview';
import { basicsErrors, hasErrors } from '../../onboarding/validation';
import type { Sex } from '@fitplan/core';
import { tokens } from '../../theme/tokens';

const SEXES = ['male', 'female', 'unspecified'] as const satisfies readonly Sex[];
const UNITS = ['metric', 'imperial'] as const satisfies readonly UnitSystem[];

export default function Basics() {
  const { t } = useLocale();
  const { draft, updateDraft } = useOnboarding();
  const [attempted, setAttempted] = useState(false);

  const errors = basicsErrors(draft);
  const show = (key: keyof typeof errors) => {
    const message = attempted ? errors[key] : undefined;
    return message ? t(message) : null;
  };
  const imperial = draft.unitSystem === 'imperial';

  function next() {
    setAttempted(true);
    if (!hasErrors(errors)) router.push('/lifestyle');
  }

  return (
    <StepLayout
      step={2}
      title={t('onboarding.basics.title')}
      subtitle={t('onboarding.basics.subtitle')}
      preview={computePreview(draft)}
      onBack={() => router.back()}
      onNext={next}
    >
      <TextField
        label={t('onboarding.age.label')}
        value={draft.age}
        onChangeText={(age) => updateDraft((d) => ({ ...d, age }))}
        keyboardType="number-pad"
        maxLength={3}
      />
      <ErrorText message={show('age')} />

      <View style={styles.group}>
        <Text style={styles.label}>{t('onboarding.sex.label')}</Text>
        <SegmentedControl
          label={t('onboarding.sex.label')}
          value={draft.sex}
          options={SEXES.map((sex) => ({ value: sex, label: t(`onboarding.sex.${sex}`) }))}
          onChange={(sex) => updateDraft((d) => ({ ...d, sex }))}
        />
        <Text style={styles.hint}>{t('onboarding.sex.hint')}</Text>
        <ErrorText message={show('sex')} />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>{t('onboarding.units.label')}</Text>
        <SegmentedControl
          label={t('onboarding.units.label')}
          value={draft.unitSystem}
          options={UNITS.map((unit) => ({ value: unit, label: t(`onboarding.units.${unit}`) }))}
          onChange={(unit) => updateDraft((d) => switchUnitSystem(d, unit))}
        />
      </View>

      {imperial ? (
        <View style={styles.row}>
          <View style={styles.cell}>
            <TextField
              label={t('onboarding.height.ft')}
              value={draft.height.ft}
              onChangeText={(v) => updateDraft((d) => setHeightField(d, 'ft', v))}
              keyboardType="number-pad"
              maxLength={1}
            />
          </View>
          <View style={styles.cell}>
            <TextField
              label={t('onboarding.height.in')}
              value={draft.height.in}
              onChangeText={(v) => updateDraft((d) => setHeightField(d, 'in', v))}
              keyboardType="decimal-pad"
              maxLength={4}
            />
          </View>
        </View>
      ) : (
        <TextField
          label={t('onboarding.height.cm')}
          value={draft.height.cm}
          onChangeText={(v) => updateDraft((d) => setHeightField(d, 'cm', v))}
          keyboardType="decimal-pad"
          maxLength={5}
        />
      )}
      <ErrorText message={show('height')} />

      <TextField
        label={imperial ? t('onboarding.weight.lb') : t('onboarding.weight.kg')}
        value={imperial ? draft.weight.lb : draft.weight.kg}
        onChangeText={(v) => updateDraft((d) => setWeightField(d, imperial ? 'lb' : 'kg', v))}
        keyboardType="decimal-pad"
        maxLength={5}
      />
      <ErrorText message={show('weight')} />
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
  hint: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
  row: {
    flexDirection: 'row',
    gap: tokens.space.md,
  },
  cell: {
    flex: 1,
  },
});
