import Ionicons from '@expo/vector-icons/Ionicons';
import type { Meal } from '@fitplan/validators';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { FavoriteFood, MealTemplate } from '../diary/api-types';
import { localDate } from '../diary/dates';
import { useLocale } from '../i18n';
import { ADDED_MS, createAddLock } from '../library/add-lock';
import { favoriteInitial, favoriteName, favoriteValue } from '../library/favorites-view';
import { LIBRARY_IMAGES } from '../library/images';
import { mealAt } from '../library/library-view';
import { api } from '../lib/api';
import { call, failureText, type CallResponse, type Failure } from '../lib/request';
import { withJson } from '../lib/with-json';
import { tokens } from '../theme/tokens';
import { Card, CardHeader } from './card';
import { type } from './display';
import { ErrorText } from './form';
import { LibraryGrid, TILE_IMAGE_SIZE, tileStyles } from './library-grid';
import { SLOT_COLORS } from './meal-plate';

/** How long a failed "＋"'s reason stays up. */
const FAILED_NOTICE_MS = 2 * ADDED_MS;

/** What the last "＋" did. */
export type MyLibraryNotice = { kind: 'added'; text: string } | { kind: 'failed'; failure: Failure };

type Props = {
  favorites: FavoriteFood[];
  templates: MealTemplate[];
  /**
   * Reports what the last "＋" did (null = nothing to say any more). The screen pins it to the
   * bottom, so it is seen wherever the "＋" was, and the grid does not move under the finger.
   */
  onNotice: (notice: MyLibraryNotice | null) => void;
};

/**
 * The food library's "我的" group: the foods the user starred as a picture grid, then their saved
 * meals. "＋" (or a saved meal's row) logs it to today, in the meal the time of day suggests.
 */
export function MyLibrary({ favorites, templates, onNotice }: Props) {
  const { t, locale } = useLocale();
  /** Added a moment ago: these show "✓". */
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const [lock] = useState(() => createAddLock(setAdded));
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** Show what the last "＋" did for a few seconds (a failure a little longer, to be read). */
  const showNotice = useCallback(
    (notice: MyLibraryNotice | null) => {
      clearTimeout(noticeTimer.current);
      onNotice(notice);
      if (notice) noticeTimer.current = setTimeout(() => onNotice(null), notice.kind === 'added' ? ADDED_MS : FAILED_NOTICE_MS);
    },
    [onNotice],
  );

  // Leaving the tab ends every "✓" and its line.
  useFocusEffect(
    useCallback(
      () => () => {
        lock.reset();
        showNotice(null);
      },
      [lock, showNotice],
    ),
  );

  /** Run one add; the date and the meal are read at the tap, not when the tab loaded. */
  async function add(key: string, name: string, request: (date: string, meal: Meal) => Promise<CallResponse>) {
    if (!lock.take(key)) return;
    const now = new Date();
    const meal = mealAt(now);
    const out = await call('recent.error', () => request(localDate(now), meal));
    if (out.kind !== 'ok') {
      // Not added: the "＋" works again.
      lock.release(key);
      if (out.kind === 'failed') showNotice({ kind: 'failed', failure: out.failure });
      return;
    }
    lock.added(key);
    showNotice({ kind: 'added', text: t('library.mine.added', { meal: t(`meal.${meal}`), food: name }) });
  }

  const addFood = (food: FavoriteFood, name: string) =>
    void add(`food:${food.id}`, name, (date, meal) =>
      api.api.diary.entries.$post({ json: { date, meal, foodId: food.id, portionId: food.portionId, quantity: food.quantity } }),
    );

  const addTemplate = (template: MealTemplate) =>
    void add(`meal:${template.id}`, template.name, (date, meal) =>
      api.api['meal-templates'][':id'].apply.$post(withJson({ id: template.id }, { date, meal })),
    );

  const meal = t(`meal.${mealAt(new Date())}`);
  return (
    <>
      {favorites.length === 0 ? (
        <Text style={styles.muted}>{t('library.mine.empty')}</Text>
      ) : (
        <LibraryGrid
            items={favorites}
            renderTile={(food, width) => {
              const name = favoriteName(food, locale);
              return (
                <FavoriteTile
                  key={food.id}
                  food={food}
                  name={name}
                  value={favoriteValue(food, t)}
                  width={width}
                  added={added.has(`food:${food.id}`)}
                  addLabel={t('library.mine.add', { food: name, meal })}
                  addedLabel={t('recent.added')}
                  onAdd={() => addFood(food, name)}
                />
              );
            }}
          />
      )}

      {templates.length > 0 ? (
        <Card>
          <CardHeader label={t('templates.title')} />
          {templates.map((template) => (
            <MealRow
              key={template.id}
              title={template.name}
              subtitle={`${t('templates.items', { n: template.items.length })} · ${t('report.kcal', { n: template.kcal })}`}
              added={added.has(`meal:${template.id}`)}
              addLabel={t('templates.addLabel', { name: template.name, meal })}
              addedLabel={t('recent.added')}
              onAdd={() => addTemplate(template)}
            />
          ))}
        </Card>
      ) : null}
    </>
  );
}

type MealRowProps = { title: string; subtitle: string; added: boolean; addLabel: string; addedLabel: string; onAdd: () => void };

/** A saved meal: its foods, how many and their kcal, and the same "＋" as a tile. */
function MealRow({ title, subtitle, added, addLabel, addedLabel, onAdd }: MealRowProps) {
  return (
    <View style={styles.meal}>
      <View accessible accessibilityLabel={`${title}, ${subtitle}`} style={styles.mealTexts}>
        <Text style={styles.mealTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[type.num, styles.mealValue]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <AddButton added={added} addLabel={addLabel} addedLabel={addedLabel} onAdd={onAdd} />
    </View>
  );
}

type AddButtonProps = { added: boolean; addLabel: string; addedLabel: string; onAdd: () => void; corner?: boolean };

/** The round "＋" that logs a food or a meal to today; a "✓" once it has. */
function AddButton({ added, addLabel, addedLabel, onAdd, corner = false }: AddButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={added ? addedLabel : addLabel}
      hitSlop={tokens.space.sm}
      onPress={onAdd}
      style={({ pressed }) => [styles.add, corner && styles.addCorner, added && styles.addDone, pressed && tileStyles.tilePressed]}
    >
      <Ionicons
        name={added ? 'checkmark' : 'add'}
        size={tokens.fontSize.subtitle}
        color={tokens.color.onPrimary}
      />
    </Pressable>
  );
}

/** The bar that says what the last "＋" did: "已加到午餐：水煮蛋", or why it failed. */
export function MyLibraryNoticeLine({ notice }: { notice: MyLibraryNotice }) {
  const { t } = useLocale();
  return (
    <View style={styles.notice}>
      {notice.kind === 'failed' ? (
        <ErrorText message={failureText(notice.failure, t)} />
      ) : (
        <View accessibilityLiveRegion="polite" style={styles.noticeRow}>
          <Ionicons name="checkmark-circle" size={tokens.fontSize.subtitle} color={tokens.color.success} />
          <Text style={styles.noticeText} numberOfLines={1}>
            {notice.text}
          </Text>
        </View>
      )}
    </View>
  );
}

type TileProps = {
  food: FavoriteFood;
  name: string;
  value: string;
  width: number;
  added: boolean;
  addLabel: string;
  addedLabel: string;
  onAdd: () => void;
};

function FavoriteTile({ food, name, value, width, added, addLabel, addedLabel, onAdd }: TileProps) {
  const image = food.libraryKey === null ? undefined : LIBRARY_IMAGES[food.libraryKey];
  return (
    <View style={{ width }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name} ${value}`}
        onPress={() => {
          const now = new Date();
          router.push({ pathname: '/food/[id]', params: { id: food.id, date: localDate(now), meal: mealAt(now) } });
        }}
        style={({ pressed }) => [tileStyles.tile, styles.tile, pressed && tileStyles.tilePressed]}
      >
        <View style={[tileStyles.plate, image ? null : styles.plateEmpty]}>
          {image ? (
            <Image source={image} style={tileStyles.image} resizeMode="contain" accessible={false} />
          ) : (
            // No picture (a searched or custom food): its plate cell's color and the name's first character.
            <View style={[styles.circle, { backgroundColor: SLOT_COLORS[food.slot] }]}>
              <Text style={styles.initial}>{favoriteInitial(name)}</Text>
            </View>
          )}
        </View>
        <Text style={tileStyles.name} numberOfLines={2}>
          {name}
        </Text>
        <Text style={[type.num, tileStyles.value]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {value}
        </Text>
      </Pressable>
      {/* A sibling of the tile, not a child: a button inside a button is not reachable by VoiceOver. */}
      <AddButton corner added={added} addLabel={addLabel} addedLabel={addedLabel} onAdd={onAdd} />
    </View>
  );
}

/** The "＋" in a tile's corner; `hitSlop` brings its touch area to the usual size. */
const ADD_SIZE = 30;
/** The circle that stands in for a picture. */
const CIRCLE_SIZE = TILE_IMAGE_SIZE - tokens.space.md;

const styles = StyleSheet.create({
  tile: {
    // Every tile of a row is as tall as the tallest (a name may take two lines).
    flex: 1,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CIRCLE_SIZE / 2,
  },
  initial: {
    color: tokens.color.onPrimary,
    fontSize: tokens.fontSize.title,
    fontWeight: tokens.fontWeight.semibold,
  },
  plateEmpty: {
    backgroundColor: tokens.color.surface,
  },
  // On the plate's corner, the same distance from its top and right edges.
  addCorner: {
    position: 'absolute',
    top: tokens.card.gap + tokens.space.xs,
    right: tokens.card.gap + tokens.space.xs,
    ...tokens.shadow.raised,
  },
  meal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingHorizontal: tokens.card.tilePaddingX,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
  },
  mealValue: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
  mealTexts: {
    flex: 1,
    gap: tokens.hairline,
  },
  mealTitle: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.body,
    fontWeight: tokens.fontWeight.medium,
  },
  add: {
    width: ADD_SIZE,
    height: ADD_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ADD_SIZE / 2,
    backgroundColor: tokens.color.primary,
  },
  addDone: {
    backgroundColor: tokens.color.success,
  },
  // Floats over the page: the lightest surface, an edge, and the one real shadow in the app.
  notice: {
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.borderStrong,
    backgroundColor: tokens.color.surfaceRaised,
    ...tokens.shadow.floating,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
  },
  noticeText: {
    flex: 1,
    color: tokens.color.text,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.medium,
  },
  muted: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.body,
    textAlign: 'center',
  },
});
