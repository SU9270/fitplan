import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Card, Tile } from '../../components/card';
import { ErrorText, PrimaryButton, TextField } from '../../components/form';
import { Screen } from '../../components/screen';
import { ScreenHeader } from '../../components/screen-header';
import { localDate } from '../../diary/dates';
import { EMPTY_QUICK_FORM, toQuickAddInput, type QuickFormField, type QuickFormValues } from '../../diary/efficiency';
import { dateParam, mealParam } from '../../diary/route-params';
import { useLocale, type MessageKey } from '../../i18n';
import { api } from '../../lib/api';
import { call, failureText, type Failure } from '../../lib/request';
import { createInFlightGuard } from '../../onboarding/in-flight';

const FIELDS: readonly { field: QuickFormField; label: MessageKey; placeholder?: MessageKey; numeric: boolean }[] = [
  { field: 'name', label: 'quick.name', placeholder: 'quick.name.placeholder', numeric: false },
  { field: 'kcal', label: 'quick.kcal', numeric: true },
  { field: 'proteinG', label: 'quick.protein', numeric: true },
  { field: 'carbsG', label: 'quick.carbs', numeric: true },
  { field: 'fatG', label: 'quick.fat', numeric: true },
];

/** "快速添加": log calories (and any macros known) without choosing a food. */
export default function QuickAdd() {
  const { t } = useLocale();
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const date = dateParam(params.date, localDate(new Date()));
  const meal = mealParam(params.meal);
  const [values, setValues] = useState<QuickFormValues>(EMPTY_QUICK_FORM);
  const [errors, setErrors] = useState<Partial<Record<QuickFormField, MessageKey>>>({});
  const [error, setError] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const [runExclusive] = useState(createInFlightGuard);

  function save() {
    const result = toQuickAddInput(values, date, meal);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    void runExclusive(async () => {
      setBusy(true);
      setError(null);
      const out = await call('food.saveError', () => api.api.diary.quick.$post({ json: result.input }));
      setBusy(false);
      if (out.kind === 'failed') setError(out.failure);
      if (out.kind === 'ok') router.dismissTo('/today');
    });
  }

  return (
    <Screen>
      <ScreenHeader title={t('quick.title')} subtitle={t('quick.subtitle')} />
      <Card>
        {FIELDS.map(({ field, label, placeholder, numeric }) => (
          <Tile key={field}>
            <TextField
              label={t(label)}
              placeholder={placeholder ? t(placeholder) : undefined}
              value={values[field]}
              onChangeText={(text) => setValues({ ...values, [field]: text })}
              keyboardType={numeric ? 'decimal-pad' : 'default'}
              autoFocus={field === 'kcal'}
            />
            <ErrorText message={errors[field] ? t(errors[field]) : null} />
          </Tile>
        ))}
      </Card>
      <ErrorText message={error && failureText(error, t)} />
      <PrimaryButton title={t('food.addTo', { meal: t(`meal.${meal}`) })} onPress={save} busy={busy} />
    </Screen>
  );
}
