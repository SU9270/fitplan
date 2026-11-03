import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from '../../components/card';
import { ErrorText, TextButton } from '../../components/form';
import { ListRow } from '../../components/list-row';
import { QuickPicks } from '../../components/quick-picks';
import { Screen } from '../../components/screen';
import { ScreenHeader } from '../../components/screen-header';
import type { FoodSummary } from '../../diary/api-types';
import { localDate } from '../../diary/dates';
import { displayName } from '../../diary/display';
import { dateParam, mealParam } from '../../diary/route-params';
import { useLocale } from '../../i18n';
import { api } from '../../lib/api';
import { signOutIfUnauthorized } from '../../lib/unauthorized';
import { tokens } from '../../theme/tokens';

/** Wait this long after the last keystroke before searching. */
const DEBOUNCE_MS = 300;

type Results = { state: 'idle' } | { state: 'loading' } | { state: 'error' } | { state: 'ready'; q: string; foods: FoodSummary[] };

/** Search USDA and the user's own foods; a result opens the food to log it into `meal` on `date`. */
export default function FoodSearch() {
  const { t, locale } = useLocale();
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const date = dateParam(params.date, localDate(new Date()));
  const meal = mealParam(params.meal);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Results>({ state: 'idle' });
  const latestRequest = useRef(0);

  useEffect(() => {
    const q = query.trim();
    const request = ++latestRequest.current;
    if (q === '') {
      setResults({ state: 'idle' });
      return;
    }
    setResults((current) => (current.state === 'ready' ? current : { state: 'loading' }));
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await api.api.foods.$get({ query: { q } });
          if (await signOutIfUnauthorized(res)) return;
          if (!res.ok) throw new Error(`GET /api/foods → ${res.status}`);
          const body = await res.json();
          if (request === latestRequest.current) setResults({ state: 'ready', q, foods: body.foods });
        } catch {
          if (request === latestRequest.current) setResults({ state: 'error' });
        }
      })();
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Screen>
      <ScreenHeader title={t('food.addTo', { meal: t(`meal.${meal}`) })} />
      <View style={styles.search}>
        <Ionicons name="search" size={tokens.fontSize.subtitle} color={tokens.color.textSecondary} />
        <TextInput
          accessibilityLabel={t('food.search.label')}
          accessibilityHint={t('food.search.hint')}
          placeholder={t('food.search.placeholder')}
          placeholderTextColor={tokens.color.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
          style={styles.input}
        />
      </View>

      {results.state === 'idle' ? <QuickPicks date={date} meal={meal} /> : null}
      {results.state === 'loading' ? (
        <ActivityIndicator color={tokens.color.primary} accessibilityLabel={t('gate.loading')} />
      ) : null}
      {results.state === 'error' ? <ErrorText message={t('food.search.error')} /> : null}
      {results.state === 'ready' && results.foods.length === 0 ? (
        <Text style={styles.muted}>{t('food.search.noResults', { q: results.q })}</Text>
      ) : null}
      {results.state === 'ready' && results.foods.length > 0 ? (
        <Card>
          {results.foods.map((food) => (
            <ListRow
              key={food.id}
              title={displayName(food, locale)}
              subtitle={locale === 'zh' && food.nameZh ? food.name : undefined}
              badge={food.source === 'custom' ? t('food.custom') : undefined}
              value={
                food.per100g.kcal === null ? t('food.per100g.unknown') : t('food.per100g', { n: Math.round(food.per100g.kcal) })
              }
              onPress={() => router.push({ pathname: '/food/[id]', params: { id: food.id, date, meal } })}
            />
          ))}
        </Card>
      ) : null}

      <View style={styles.footer}>
        <TextButton
          title={t('food.search.createCustom')}
          onPress={() => router.push({ pathname: '/food/custom', params: { date, meal } })}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    minHeight: tokens.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.md,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.card,
  },
  input: {
    flex: 1,
    minHeight: tokens.touchTarget,
    color: tokens.color.text,
    fontSize: tokens.fontSize.body,
  },
  muted: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.body,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
  },
});
