import Ionicons from '@expo/vector-icons/Ionicons';
import type { LibraryGroup } from '@fitplan/core';
import type { InferResponseType } from 'hono/client';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Kicker, Title, type } from '../../components/display';
import { ErrorText, PrimaryButton } from '../../components/form';
import { LibraryGrid, TILE_IMAGE_SIZE, tileStyles } from '../../components/library-grid';
import { MyLibrary, MyLibraryNoticeLine, type MyLibraryNotice } from '../../components/my-library';
import { Screen } from '../../components/screen';
import type { FavoriteFood, MealTemplate } from '../../diary/api-types';
import { localDate } from '../../diary/dates';
import { kicker, useLocale } from '../../i18n';
import { initialTab, LIBRARY_TABS, type LibraryTab } from '../../library/favorites-view';
import { LIBRARY_IMAGES } from '../../library/images';
import { groupValue, mealAt, shortName } from '../../library/library-view';
import { api } from '../../lib/api';
import { call, failureText, type Failure } from '../../lib/request';
import { tokens } from '../../theme/tokens';

type LibraryFood = InferResponseType<typeof api.api.foods.library.$get, 200>['foods'][number];
type Loaded =
  | { state: 'loading' }
  | { state: 'error'; failure: Failure }
  | { state: 'ready'; foods: LibraryFood[]; favorites: FavoriteFood[]; templates: MealTemplate[] };

/**
 * Food library tab: the user's starred foods and saved meals ("我的"), then common foods with
 * pictures grouped by nutrition. A food opens to be logged.
 */
export default function Library() {
  const { t } = useLocale();
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  // Chosen by the first load ("我的" once it has something); the user's choice after that.
  const [tab, setTab] = useState<LibraryTab | null>(null);
  const [notice, setNotice] = useState<MyLibraryNotice | null>(null);
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    const [library, favorites, templates] = await Promise.all([
      call('library.loadError', () => api.api.foods.library.$get()),
      call('library.loadError', () => api.api.foods.favorites.$get()),
      call('library.loadError', () => api.api['meal-templates'].$get()),
    ]);
    if (request !== latestRequest.current) return;
    if (library.kind === 'signedOut' || favorites.kind === 'signedOut' || templates.kind === 'signedOut') return;
    const failed = [library, favorites, templates].find((out) => out.kind === 'failed');
    if (library.kind !== 'ok' || favorites.kind !== 'ok' || templates.kind !== 'ok') {
      if (failed?.kind === 'failed') {
        setLoaded((current) => (current.state === 'ready' ? current : { state: 'error', failure: failed.failure }));
      }
      return;
    }
    const [libraryBody, favoritesBody, templatesBody] = await Promise.all([
      library.res.json(),
      favorites.res.json(),
      templates.res.json(),
    ]);
    if (request !== latestRequest.current) return;
    setLoaded({ state: 'ready', foods: libraryBody.foods, favorites: favoritesBody.foods, templates: templatesBody.templates });
    setTab((current) => current ?? initialTab(favoritesBody.foods.length, templatesBody.templates.length));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const group = tab === null || tab === 'mine' ? null : tab;
  const foods = loaded.state === 'ready' && group !== null ? loaded.foods.filter((f) => f.groups.includes(group)) : [];

  return (
    <Screen inTabs overlay={tab === 'mine' && notice ? <MyLibraryNoticeLine notice={notice} /> : null}>
      <View style={styles.heading}>
        <Kicker>{kicker('library.title')}</Kicker>
        <Title numberOfLines={1}>{t('library.title')}</Title>
        {/* "我的" shows amounts, not per-100 g values, so it has its own line. */}
        <Text style={styles.caption}>{t(tab === 'mine' ? 'library.about.mine' : 'library.subtitle')}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        accessibilityLabel={t('library.groups')}
        contentContainerStyle={styles.chips}
      >
        {LIBRARY_TABS.map((g) => {
          const selected = g === tab;
          return (
            <Pressable
              key={g}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => {
                setTab(g);
                setNotice(null);
              }}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{t(`library.group.${g}`)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {group === null ? null : (
        <View style={styles.about}>
          <Ionicons name="information-circle" size={tokens.fontSize.subtitle} color={tokens.color.primary} />
          <Text style={styles.aboutText}>{t(`library.about.${group}`)}</Text>
        </View>
      )}

      {loaded.state === 'loading' ? (
        <ActivityIndicator color={tokens.color.primary} accessibilityLabel={t('gate.loading')} />
      ) : loaded.state === 'error' ? (
        <>
          <ErrorText message={failureText(loaded.failure, t)} />
          <PrimaryButton title={t('gate.error.retry')} onPress={() => void load()} />
        </>
      ) : group === null ? (
        tab === 'mine' ? <MyLibrary favorites={loaded.favorites} templates={loaded.templates} onNotice={setNotice} /> : null
      ) : loaded.foods.length === 0 ? (
        <Text style={styles.muted}>{t('library.empty')}</Text>
      ) : foods.length === 0 ? (
        <Text style={styles.muted}>{t('library.groupEmpty')}</Text>
      ) : (
        <LibraryGrid
          items={foods}
          renderTile={(food, width) => <FoodTile key={food.id} food={food} group={group} width={width} />}
        />
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
      style={({ pressed }) => [tileStyles.tile, { width }, pressed && tileStyles.tilePressed]}
    >
      <View style={tileStyles.plate}>
        {image ? (
          <Image source={image} style={tileStyles.image} resizeMode="contain" accessible={false} />
        ) : (
          // A food added on the server before the app has its picture.
          <Ionicons name="nutrition-outline" size={TILE_IMAGE_SIZE / 2} color={tokens.color.paperQuiet} />
        )}
      </View>
      <Text style={tileStyles.name} numberOfLines={1}>
        {name}
      </Text>
      {/* Long values such as "EPA+DHA 2140 毫克" shrink to fit instead of being cut off. */}
      <Text style={[type.num, tileStyles.value]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {valueText}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: tokens.hairline,
  },
  caption: {
    marginTop: tokens.hairline,
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.label,
  },
  about: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.card,
  },
  aboutText: {
    flex: 1,
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
    lineHeight: tokens.fontSize.caption * 1.4,
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
    borderWidth: 1.5,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.card,
  },
  // The chosen group is the one filled chip in the row.
  chipSelected: {
    borderColor: tokens.color.primary,
    backgroundColor: tokens.color.primary,
  },
  chipText: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.medium,
  },
  chipTextSelected: {
    color: tokens.color.onPrimary,
    fontWeight: tokens.fontWeight.heavy,
  },
});
