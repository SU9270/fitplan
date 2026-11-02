import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ErrorText, PrimaryButton, TextField } from '../../components/form';
import { Screen } from '../../components/screen';
import { ScreenHeader } from '../../components/screen-header';
import { EMPTY_CUSTOM_FORM, formFromFood, toCustomFoodInput, type CustomFormField, type CustomFormValues } from '../../diary/custom-form';
import { stringParam } from '../../diary/route-params';
import { useLocale, type MessageKey } from '../../i18n';
import { api } from '../../lib/api';
import { signOutIfUnauthorized } from '../../lib/unauthorized';
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
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [runExclusive] = useState(createInFlightGuard);

  useEffect(() => {
    if (id === null) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.api.foods[':id'].$get({ param: { id } });
        if (await signOutIfUnauthorized(res)) return;
        if (!res.ok) throw new Error(`GET /api/foods/${id} → ${res.status}`);
        const body = await res.json();
        if (!cancelled) setValues(formFromFood(body.food));
      } catch {
        if (!cancelled) setError('food.loadError');
      }
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
      try {
        const res =
          id === null
            ? await api.api.foods.$post({ json: result.input })
            : await api.api.foods[':id'].$put(withJson({ id }, result.input));
        if (await signOutIfUnauthorized(res)) return;
        if (!res.ok) {
          setError(res.status === 404 ? 'food.notFound' : 'food.saveError');
          return;
        }
        if (id !== null) {
          router.back();
          return;
        }
        const body = (await res.json()) as { food: { id: string } };
        router.replace({ pathname: '/food/[id]', params: { id: body.food.id, date: params.date, meal: params.meal } });
      } catch {
        setError('food.saveError');
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <Screen>
      <ScreenHeader title={t(id === null ? 'custom.title.new' : 'custom.title.edit')} subtitle={t('custom.subtitle')} />
      {values === null ? (
        error ? (
          <ErrorText message={t(error)} />
        ) : (
          <ActivityIndicator color={tokens.color.primary} accessibilityLabel={t('gate.loading')} />
        )
      ) : (
        <>
          {FIELDS.map(({ field, label, placeholder, numeric }) => (
            <View key={field} style={styles.field}>
              <TextField
                label={t(label)}
                placeholder={placeholder ? t(placeholder) : undefined}
                value={values[field]}
                onChangeText={(text) => setValues({ ...values, [field]: text })}
                keyboardType={numeric ? 'decimal-pad' : 'default'}
                autoCapitalize="none"
              />
              <ErrorText message={errors[field] ? t(errors[field]) : null} />
            </View>
          ))}
          <ErrorText message={error && t(error)} />
          <PrimaryButton title={t('common.save')} onPress={save} busy={busy} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: tokens.space.xs,
  },
});
