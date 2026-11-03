import Ionicons from '@expo/vector-icons/Ionicons';
import type { Meal } from '@fitplan/validators';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MealTemplate, RecentFood, RecentFoods } from '../diary/api-types';
import { displayName } from '../diary/display';
import { amountLabel } from '../diary/plate-view';
import { useLocale } from '../i18n';
import { api } from '../lib/api';
import { call, failureText, type Failure } from '../lib/request';
import { signOutIfUnauthorized } from '../lib/unauthorized';
import { withJson } from '../lib/with-json';
import { createInFlightGuard } from '../onboarding/in-flight';
import { tokens } from '../theme/tokens';
import { Card, CardHeader } from './card';
import { ErrorText, SoftButton } from './form';
import { ListRow } from './list-row';

type Props = { date: string; meal: Meal };

/**
 * The search screen before typing: quick add, "我的餐", and frequent / recent foods with a "+"
 * that logs the last amount again (the screen stays open, so several can be added in a row).
 */
export function QuickPicks({ date, meal }: Props) {
  const { t, locale } = useLocale();
  const [recent, setRecent] = useState<RecentFoods | null>(null);
  const [templates, setTemplates] = useState<MealTemplate[] | null>(null);
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<Failure | null>(null);
  const [runExclusive] = useState(createInFlightGuard);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          const [r, m] = await Promise.all([api.api.diary.recent.$get(), api.api['meal-templates'].$get()]);
          if ((await signOutIfUnauthorized(r)) || (await signOutIfUnauthorized(m))) return;
          if (!r.ok || !m.ok) return;
          const [recentBody, templatesBody] = await Promise.all([r.json(), m.json()]);
          if (cancelled) return;
          setRecent(recentBody);
          setTemplates(templatesBody.templates);
        } catch {
          // Without them the screen is plain search; nothing to report.
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  function relog(food: RecentFood) {
    void runExclusive(async () => {
      setError(null);
      const out = await call('recent.error', () =>
        api.api.diary.entries.$post({
          json: { date, meal, foodId: food.foodId, portionId: food.portionId, quantity: food.quantity },
        }),
      );
      if (out.kind === 'failed') setError(out.failure);
      if (out.kind === 'ok') setAdded((current) => new Set(current).add(food.foodId));
    });
  }

  function applyTemplate(template: MealTemplate) {
    void runExclusive(async () => {
      setError(null);
      const out = await call('recent.error', () =>
        api.api['meal-templates'][':id'].apply.$post(withJson({ id: template.id }, { date, meal })),
      );
      if (out.kind === 'failed') setError(out.failure);
      if (out.kind === 'ok') router.dismissTo('/today');
    });
  }

  const sections: [string, RecentFood[]][] = recent
    ? [
        [t('recent.frequent'), recent.frequent],
        [t('recent.recent'), recent.recent],
      ]
    : [];

  return (
    <>
      <SoftButton title={t('quick.open')} onPress={() => router.push({ pathname: '/food/quick', params: { date, meal } })} />
      <ErrorText message={error && failureText(error, t)} />

      {templates && templates.length > 0 ? (
        <Card>
          <CardHeader label={t('templates.title')} />
          {templates.map((template) => (
            <ListRow
              key={template.id}
              accessibilityLabel={t('templates.addLabel', { name: template.name, meal: t(`meal.${meal}`) })}
              title={template.name}
              subtitle={t('templates.items', { n: template.items.length })}
              value={t('report.kcal', { n: template.kcal })}
              onPress={() => applyTemplate(template)}
            />
          ))}
        </Card>
      ) : null}

      {sections.map(([title, foods]) =>
        foods.length > 0 ? (
          <Card key={title}>
            <CardHeader label={title} />
            {foods.map((food) => (
              <RecentRow
                key={food.foodId}
                title={displayName(food, locale)}
                subtitle={amountLabel(food.quantity, food.portionId, food.portionLabel, t)}
                kcal={food.kcal === null ? t('food.unknown') : t('report.kcal', { n: Math.round(food.kcal) })}
                added={added.has(food.foodId)}
                addLabel={t('recent.add', { food: displayName(food, locale) })}
                addedLabel={t('recent.added')}
                onOpen={() => router.push({ pathname: '/food/[id]', params: { id: food.foodId, date, meal } })}
                onAdd={() => relog(food)}
              />
            ))}
          </Card>
        ) : null,
      )}
    </>
  );
}

type RowProps = {
  title: string;
  subtitle: string;
  kcal: string;
  added: boolean;
  addLabel: string;
  addedLabel: string;
  onOpen: () => void;
  onAdd: () => void;
};

function RecentRow({ title, subtitle, kcal, added, addLabel, addedLabel, onOpen, onAdd }: RowProps) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${subtitle}, ${kcal}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.texts, pressed && styles.pressed]}
      >
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle} · {kcal}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={added ? addedLabel : addLabel}
        hitSlop={tokens.space.xs}
        onPress={onAdd}
        style={({ pressed }) => [styles.add, added && styles.addDone, pressed && styles.pressed]}
      >
        <Ionicons
          name={added ? 'checkmark' : 'add'}
          size={tokens.fontSize.title}
          color={added ? tokens.color.onPrimary : tokens.color.primary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingLeft: tokens.card.tilePaddingX,
    paddingRight: tokens.space.xs,
    paddingVertical: tokens.space.xs,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
  },
  texts: {
    flex: 1,
    gap: tokens.hairline,
  },
  pressed: {
    opacity: 0.6,
  },
  title: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.body,
    fontWeight: tokens.fontWeight.medium,
  },
  subtitle: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
  add: {
    width: tokens.touchTarget,
    height: tokens.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.primarySoft,
  },
  addDone: {
    backgroundColor: tokens.color.primary,
  },
});
