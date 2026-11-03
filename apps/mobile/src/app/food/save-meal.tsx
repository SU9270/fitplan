import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Card, Tile } from '../../components/card';
import { ErrorText, PrimaryButton, TextField } from '../../components/form';
import { Screen } from '../../components/screen';
import { ScreenHeader } from '../../components/screen-header';
import { localDate } from '../../diary/dates';
import { defaultTemplateName, entryName } from '../../diary/efficiency';
import { rememberedEntries } from '../../diary/entry-store';
import { dateParam, mealParam } from '../../diary/route-params';
import { useLocale } from '../../i18n';
import { api } from '../../lib/api';
import { signOutIfUnauthorized } from '../../lib/unauthorized';
import { createInFlightGuard } from '../../onboarding/in-flight';

/** Save one meal of a day as "我的餐", named after its first foods by default. */
export default function SaveMeal() {
  const { t, locale } = useLocale();
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const date = dateParam(params.date, localDate(new Date()));
  const meal = mealParam(params.meal);
  const [name, setName] = useState(() =>
    defaultTemplateName(
      rememberedEntries()
        .filter((e) => e.date === date && e.meal === meal)
        .map((e) => entryName(e, locale, t)),
      t,
    ),
  );
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [runExclusive] = useState(createInFlightGuard);

  function save() {
    void runExclusive(async () => {
      setBusy(true);
      setError(false);
      try {
        const res = await api.api['meal-templates'].$post({ json: { name, date, meal } });
        if (await signOutIfUnauthorized(res)) return;
        if (!res.ok) throw new Error(`POST /api/meal-templates → ${res.status}`);
        router.back();
      } catch {
        setError(true);
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <Screen>
      <ScreenHeader title={t('templates.save.title')} subtitle={t('templates.save.subtitle')} />
      <Card>
        <Tile>
          <TextField label={t('templates.save.name')} value={name} onChangeText={setName} maxLength={80} autoFocus />
        </Tile>
      </Card>
      <ErrorText message={error ? t('templates.save.error') : null} />
      <PrimaryButton title={t('common.save')} onPress={save} busy={busy} disabled={name.trim() === ''} />
    </Screen>
  );
}
