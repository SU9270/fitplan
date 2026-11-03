import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Card, Tile } from '../../components/card';
import { ErrorText, PrimaryButton, TextField } from '../../components/form';
import { Screen } from '../../components/screen';
import { ScreenHeader } from '../../components/screen-header';
import { EMPTY_CUSTOM_FORM, formFromFood, toCustomFoodInput, type CustomFormField, type CustomFormValues } from '../../diary/custom-form';
import { stringParam } from '../../diary/route-params';
import { useLocale, type MessageKey } from '../../i18n';
import { api } from '../../lib/api';
import { call, failureText, type Failure } from '../../lib/request';
import { withJson } from '../../lib/with-json';
import { createInFlightGuard } from '../../onboarding/in-flight';
import { tokens } from '../../theme/tokens';

type FieldSpec = { field: CustomFormField; label: MessageKey; placeholder?: MessageKey; numeric: boolean };

const FIELDS: readonly FieldSpec[] = [
  { field: 'name', label: 'custom.name', placeholder: 'custom.name.placeholder', numeric: false },
  { field: 'servingLabel', label: 'custom.servingLabel', placeholder: 'custom.servingLabel.placeholder', numeric: false },
  { field: 'servingGrams', label: 'custom.servingGrams', numeric: true },
  { field: 'kcal', label: 'custom.kcal', numeric: true },
  { field: 'proteinG', label: 'custom.protein', numeric: true },
  { field: 'carbsG', label: 'custom.carbs', numeric: true },
  { field: 'fatG', label: 'custom.fat', numeric: true },
];

/**
 * Create (no `id`) or edit (`id`) a custom food from its nutrition label. A new food opens its
 * food screen next (replacing this one), so it can be logged right away into `meal` on `date`.
 */
export default function CustomFood() {
  const { t } = useLocale();
  const params = useLocalSearchParams<{ id?: string; date?: string; meal?: string }>();
  const id = stringParam(params.id);
  const [values, setValues] = useState<CustomFormValues | null>(id === null ? EMPTY_CUSTOM_FORM : null);
  const [errors, setErrors] = useState<Partial<Record<CustomFormField, MessageKey>>>({});
  const [error, setError] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const [runExclusive] = useState(createInFlightGuard);

  useEffect(() => {
    if (id === null) return;
    let cancelled = false;
    void (async () => {
      const out = await call('food.loadError', () => api.api.foods[':id'].$get({ param: { id } }));
      if (cancelled || out.kind === 'signedOut') return;
      if (out.kind === 'failed') {
        setError(out.failure);
        return;
      }
      const body = await out.res.json();
      if (!cancelled) setValues(formFromFood(body.food));
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function save() {
    if (values === null) return;
    const result = toCustomFoodInput(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    void runExclusive(async () => {
      setBusy(true);
      setError(null);
      const out = await call('food.saveError', () =>
        id === null ? api.api.foods.$post({ json: result.input }) : api.api.foods[':id'].$put(withJson({ id }, result.input)),
      );
      setBusy(false);
      if (out.kind === 'signedOut') return;
      if (out.kind === 'failed') {
        setError(out.failure);
        return;
      }
      if (id !== null) {
        router.back();
        return;
      }
      const body = (await out.res.json()) as { food: { id: string } };
      router.replace({ pathname: '/food/[id]', params: { id: body.food.id, date: params.date, meal: params.meal } });
    });
  }

  return (
    <Screen>
      <ScreenHeader title={t(id === null ? 'custom.title.new' : 'custom.title.edit')} subtitle={t('custom.subtitle')} />
      {values === null ? (
        error ? (
          <ErrorText message={failureText(error, t)} />
        ) : (
          <ActivityIndicator color={tokens.color.primary} accessibilityLabel={t('gate.loading')} />
        )
      ) : (
        <>
          <Card>
            {FIELDS.map(({ field, label, placeholder, numeric }) => (
              <Tile key={field}>
                <TextField
                  label={t(label)}
                  placeholder={placeholder ? t(placeholder) : undefined}
                  value={values[field]}
                  onChangeText={(text) => setValues({ ...values, [field]: text })}
                  keyboardType={numeric ? 'decimal-pad' : 'default'}
                  autoCapitalize="none"
                />
                <ErrorText message={errors[field] ? t(errors[field]) : null} />
              </Tile>
            ))}
          </Card>
          <ErrorText message={error && failureText(error, t)} />
          <PrimaryButton title={t('common.save')} onPress={save} busy={busy} />
        </>
      )}
    </Screen>
  );
}
