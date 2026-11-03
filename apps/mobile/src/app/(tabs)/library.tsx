import Ionicons from '@expo/vector-icons/Ionicons';
import { LIBRARY_GROUPS, type LibraryGroup } from '@fitplan/core';
import type { InferResponseType } from 'hono/client';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/card';
import { ErrorText, PrimaryButton } from '../../components/form';
import { Screen } from '../../components/screen';
import { localDate } from '../../diary/dates';
import { useLocale } from '../../i18n';
import { LIBRARY_IMAGES } from '../../library/images';
import { groupValue, mealAt, shortName } from '../../library/library-view';
import { api } from '../../lib/api';
import { call, failureText, type Failure } from '../../lib/request';
import { tokens } from '../../theme/tokens';

type LibraryFood = InferResponseType<typeof api.api.foods.library.$get, 200>['foods'][number];
type Loaded = { state: 'loading' } | { state: 'error'; failure: Failure } | { state: 'ready'; foods: LibraryFood[] };

const COLUMNS = 3;
const IMAGE_SIZE = 64;

/** Food library tab: common foods with pictures, grouped by nutrition; a food opens to be logged. */
export default function Library() {
  const { t } = useLocale();
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [group, setGroup] = useState<LibraryGroup>('carbs');
  const [gridWidth, setGridWidth] = useState(0);
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    const out = await call('library.loadError', () => api.api.foods.library.$get());
    if (out.kind === 'signedOut' || request !== latestRequest.current) return;
    if (out.kind === 'failed') {
      setLoaded((current) => (current.state === 'ready' ? current : { state: 'error', failure: out.failure }));
      return;
    }
    const body = await out.res.json();
    if (request === latestRequest.current) setLoaded({ state: 'ready', foods: body.foods });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const foods = loaded.state === 'ready' ? loaded.foods.filter((f) => f.groups.includes(group)) : [];
  const tileWidth = gridWidth > 0 ? (gridWidth - tokens.card.gap * (COLUMNS - 1)) / COLUMNS : 0;

  return (
    <Screen inTabs>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('library.title')}
        </Text>
        <Text style={styles.caption}>{t('library.subtitle')}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        accessibilityLabel={t('library.groups')}
        contentContainerStyle={styles.chips}
      >
        {LIBRARY_GROUPS.map((g) => {
          const selected = g === group;
          return (
            <Pressable
              key={g}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setGroup(g)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{t(`library.group.${g}`)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={styles.caption}>{t(`library.about.${group}`)}</Text>

      {loaded.state === 'loading' ? (
        <ActivityIndicator color={tokens.color.primary} accessibilityLabel={t('gate.loading')} />
      ) : loaded.state === 'error' ? (
        <>
          <ErrorText message={failureText(loaded.failure, t)} />
          <PrimaryButton title={t('gate.error.retry')} onPress={() => void load()} />
        </>
      ) : loaded.foods.length === 0 ? (
        <Text style={styles.muted}>{t('library.empty')}</Text>
      ) : foods.length === 0 ? (
        <Text style={styles.muted}>{t('library.groupEmpty')}</Text>
      ) : (
        <Card>
          <View style={styles.grid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
            {tileWidth > 0 ? foods.map((food) => <FoodTile key={food.id} food={food} group={group} width={tileWidth} />) : null}
          </View>
        </Card>
      )}
    </Screen>
  );
}

function FoodTile({ food, group, width }: { food: LibraryFood; group: LibraryGroup; width: number }) {
  const { t, locale } = useLocale();
  const name = shortName(food, locale);
  const value = groupValue(food, group);
  const valueText = value ? t(value.key, { n: value.n }) : t('food.unknown');
  const image = LIBRARY_IMAGES[food.key];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} ${valueText}`}
      onPress={() =>
        router.push({ pathname: '/food/[id]', params: { id: food.id, date: localDate(new Date()), meal: mealAt(new Date()) } })
      }
      style={({ pressed }) => [styles.tile, { width }, pressed && styles.tilePressed]}
    >
      {image ? (
        <Image source={image} style={styles.image} resizeMode="contain" accessible={false} />
      ) : (
        // A food added on the server before the app has its picture.
        <View style={[styles.image, styles.placeholder]}>
          <Ionicons name="nutrition-outline" size={IMAGE_SIZE / 2} color={tokens.color.textTertiary} />
        </View>
      )}
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.value} numberOfLines={1}>
        {valueText}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: tokens.space.xs,
  },
  title: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.title,
    fontWeight: tokens.fontWeight.semibold,
  },
  caption: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
  muted: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.body,
    textAlign: 'center',
  },
  chips: {
    gap: tokens.space.sm,
  },
  chip: {
    minHeight: tokens.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: tokens.space.lg,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
  },
  chipSelected: {
    borderColor: tokens.color.primary,
    backgroundColor: tokens.color.primarySoft,
  },
  chipText: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.medium,
  },
  chipTextSelected: {
    color: tokens.color.primary,
    fontWeight: tokens.fontWeight.semibold,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.card.gap,
  },
  tile: {
    alignItems: 'center',
    gap: tokens.space.xs,
    paddingHorizontal: tokens.space.xs,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
  },
  tilePressed: {
    opacity: 0.6,
  },
  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.medium,
  },
  value: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
});
