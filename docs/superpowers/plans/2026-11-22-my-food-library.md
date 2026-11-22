# 「我的食物库」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users star foods on the food page; the food library tab gets a first group 「我的」 that shows the starred foods as a picture grid plus the saved meals, each with a one-tap "＋" that logs it to today.

**Architecture:** A new `favorite_foods` table (user + food) with three routes under `/api/foods`. The list route returns each favorite with the amount a one-tap add should use (last logged amount, else the food page's default). The mobile library tab loads favorites and saved meals next to the library and renders them in a new `MyLibrary` component; pure display rules live in `library/favorites-view.ts`.

**Tech Stack:** Hono + Drizzle + D1 (vitest with `@cloudflare/vitest-plugin`); Expo / React Native + expo-router (jest-expo); Hono RPC client types.

**Spec:** `docs/superpowers/specs/2026-11-22-my-food-library-design.md`

## Global Constraints

- Run every command from the repo root after `export PATH=~/bin:$PATH`.
- **Never commit or push.** The owner commits by hand. Each task ends with the changes left in the working tree. The tree already holds unrelated uncommitted work (search ranking, meal card); do not revert or reformat it.
- Migrations only add: this one is a new table (`0007`). Do not alter existing tables.
- Every user-visible string goes into `apps/mobile/src/i18n/zh.ts` and `en.ts` with identical keys and identical `{placeholders}`.
- Requests from screens go through `call()` / `failureText()` in `apps/mobile/src/lib/request.ts`.
- Neutral tone: no red warnings, no "推荐". Colors and sizes come from `apps/mobile/src/theme/tokens.ts`.
- Code comments in English. Do not run Prettier over whole files.
- Search page (`quick-picks.tsx`), `meal_templates`, and the other library groups keep their behavior.
- Unknown nutrients stay `null`, never 0.

## Review Focus

1. **More than 100 favorites.** D1 allows 100 bound parameters per query; the list must still return all of them. (Task 1, test "lists more than 100 favorites".)
2. **The last-logged portion was deleted.** The entry's `portion_id` is NULL but its label remains; the one-tap amount must fall back to grams, not send a dead label. (Task 1, test "falls back to grams".)
3. **A name that starts with an emoji or a space.** The placeholder letter must be one whole character, never half a surrogate pair or a blank. (Task 2, test "favoriteInitial".)
4. **"＋" fails** (no health-data consent → 403, or the starred custom food was deleted in another session → 404/400). The tile must not turn into "✓"; the error text appears where the "已加到…" line would. (Task 4, simulator step 6.)
5. **Tapping "＋" twice quickly, or around midnight / a meal boundary.** One entry per tap sequence (in-flight guard), and the date and meal are read at tap time, not when the tab loaded. (Task 4, step 3 + simulator step 5.)

---

### Task 1: API — favorites table, service, routes

**Files:**
- Modify: `apps/api/src/db/schema.ts` (add `favoriteFoods` after `foodPortions`)
- Create: `apps/api/migrations/0007_favorite_foods.sql` (+ `meta/0007_snapshot.json`, `meta/_journal.json`, all generated)
- Create: `apps/api/src/foods/favorite-service.ts`
- Modify: `apps/api/src/foods/food-service.ts` (`FoodDetail.favorite`, `getFood`)
- Modify: `apps/api/src/routes/foods.ts`
- Test: `apps/api/test/favorites.test.ts`

**Interfaces:**
- Consumes: `findVisibleFood`, `toSummary`, `FoodSummary` (food-service); `scaleNutrients` (`@fitplan/core`); test helpers `authed`, `signedInUser`, `seedUsdaFood`.
- Produces (later tasks rely on the JSON shapes through the Hono client):
  - `PUT /api/foods/:id/favorite` → 204; 404 `{ code: 'not_found' }` when the food is not visible to the user.
  - `DELETE /api/foods/:id/favorite` → 204 always.
  - `GET /api/foods/favorites` → 200 `{ foods: FavoriteFood[] }`, newest favorite first.
  - `GET /api/foods/:id` → `food.favorite: boolean`.

```ts
// favorite-service.ts
export interface FavoriteFood extends FoodSummary {
  libraryKey: string | null;
  /** The amount a one-tap add logs: a portion, or grams when portionId is null. */
  portionId: string | null;
  portionLabel: string | null;
  quantity: number;
  grams: number;
  /** kcal of that amount with the food's current values; null = unknown. */
  kcal: number | null;
}
export async function addFavorite(db: Db, userId: string, foodId: string, now?: Date): Promise<boolean>; // false = not visible
export async function removeFavorite(db: Db, userId: string, foodId: string): Promise<void>;
export async function listFavorites(db: Db, userId: string): Promise<FavoriteFood[]>;
```

- [ ] **Step 1: Write the failing tests** in `apps/api/test/favorites.test.ts` (copy the `consentedUser`, `log`, `today` helpers' pattern from `logging-efficiency.test.ts`):

```ts
it('stars a food once, lists it, and unstars it', async () => {
  // PUT twice → 204, 204; GET favorites → exactly one item with id === food.id; GET /api/foods/:id → favorite true
  // DELETE twice → 204, 204; GET favorites → []; GET /api/foods/:id → favorite false
});
it('lists newest favorites first with the library key', async () => {
  // star a, then b (set a's created_at one minute earlier by SQL) → ids [b, a]
  // a food whose library_key was set by SQL to 'egg' → libraryKey 'egg'; others null
});
it("refuses another user's custom food and keeps lists apart", async () => {
  // user B creates a custom food; user A PUT → 404 { code: 'not_found' }; A's list is []
  // A stars a USDA food; B's list is []
});
it('drops a deleted custom food from the list', async () => {
  // create custom food, star it, DELETE /api/foods/:id → list is []
});
it('uses the last logged amount', async () => {
  // food with portions [{label:'1 large', grams:50}], kcal 150/100 g; star it
  // log portion × 2, then log 80 g with portionId null; push the first entry's created_at back by SQL
  // → { portionId: null, portionLabel: null, quantity: 80, grams: 80, kcal: 120 }
});
it('uses the first portion × 1, or 100 g, for a food never logged', async () => {
  // portions [{label:'1 large', grams:50}, {label:'1 cup', grams:240}], kcal 150
  // → { portionId: ids[0], portionLabel: '1 large', quantity: 1, grams: 50, kcal: 75 }
  // no portions, kcal null → { portionId: null, portionLabel: null, quantity: 100, grams: 100, kcal: null }
});
it('falls back to grams when the logged portion was deleted', async () => {
  // log portion × 2 (grams 100); DELETE FROM food_portions WHERE id = that portion (entry.portion_id becomes NULL)
  // → { portionId: null, portionLabel: null, quantity: 100, grams: 100 }
});
it('lists more than 100 favorites', async () => {
  // seed 120 foods, INSERT 120 favorite_foods rows by SQL → GET returns 120 foods, status 200
});
it('needs a session', async () => {
  // GET /api/foods/favorites without a cookie → 401
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm --filter @fitplan/api test -- favorites`
Expected: FAIL (404 on the new routes / no such table `favorite_foods`).

- [ ] **Step 3: Add the table and generate the migration**

`favoriteFoods` = `sqliteTable('favorite_foods', …)`: `userId` text not null → `user.id` on delete cascade; `foodId` text not null → `foods.id` on delete cascade; `createdAt` text not null default `nowIso`; composite primary key (`userId`, `foodId`).

Run: `pnpm --filter @fitplan/api exec drizzle-kit generate --name favorite_foods`
Expected: `apps/api/migrations/0007_favorite_foods.sql` containing only `CREATE TABLE \`favorite_foods\``. If it contains anything else (an `ALTER` or a table rebuild), stop and report instead of editing by hand.

- [ ] **Step 4: Implement `favorite-service.ts`**

- `addFavorite`: `findVisibleFood` first; insert with `onConflictDoNothing()`.
- `listFavorites`: favorites joined to `foods`, ordered `created_at DESC, rowid DESC`. Amounts in **two more queries, each filtered by a subquery on `favorite_foods` for this user, never by a bound list of ids**: (a) the user's diary entries for those foods, newest first (`created_at DESC, rowid DESC`), first row per food wins; (b) those foods' portions ordered `sort_order, id`, first per food wins.
- Amount from an entry, same rule as `getRecentFoods` in `diary/diary-service.ts`: `byPortion = entry.portionId !== null`; `quantity = byPortion ? entry.quantity : entry.grams`; `portionLabel = byPortion ? entry.portionLabel : null`; `grams = entry.grams`.
- Amount without an entry: first portion → `quantity 1`, `grams = portion.grams`, its id and label; no portion → `quantity 100`, `grams 100`, ids null.
- `kcal = scaleNutrients(per100g, grams).kcal`.

- [ ] **Step 5: `FoodDetail.favorite` and the routes**

- `food-service.ts`: add `favorite: boolean` to `FoodDetail`; `getFood` sets it with one lookup in `favorite_foods` (query the table directly there; do not import `favorite-service` into `food-service`).
- `routes/foods.ts`: `.get('/favorites', …)` goes next to `/mine` and `/library`, **before** `'/:id'`. `.put('/:id/favorite', …)` and `.delete('/:id/favorite', …)` return `c.body(null, 204)`; the PUT returns `c.json(notFound, 404)` when `addFavorite` is false.

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @fitplan/api test`
Expected: all files PASS (the existing `foods.test.ts` detail assertions may need `favorite: false` added where they compare whole objects).

Run: `pnpm --filter @fitplan/api typecheck`
Expected: no errors.

- [ ] **Step 7: Leave the changes uncommitted.**

---

### Task 2: Mobile — display rules and strings

**Files:**
- Create: `apps/mobile/src/library/favorites-view.ts`
- Test: `apps/mobile/src/library/favorites-view.test.ts`
- Modify: `apps/mobile/src/diary/api-types.ts`
- Modify: `apps/mobile/src/i18n/zh.ts`, `apps/mobile/src/i18n/en.ts`

**Interfaces:**
- Consumes: Task 1's routes (types only); `shortName` (`library/library-view.ts`); `formatNumber` (`diary/amount.ts`); `LIBRARY_GROUPS`, `LibraryGroup` (`@fitplan/core`).
- Produces:

```ts
// api-types.ts
export type FavoriteFood = InferResponseType<typeof api.api.foods.favorites.$get, 200>['foods'][number];

// favorites-view.ts
export type LibraryTab = 'mine' | LibraryGroup;
export const LIBRARY_TABS: readonly LibraryTab[];            // ['mine', ...LIBRARY_GROUPS]
export function initialTab(favorites: number, templates: number): LibraryTab;
export function favoriteName(food: { name: string; nameZh: string | null; libraryKey: string | null }, locale: Locale): string;
export function favoriteInitial(name: string): string;
export function favoriteValue(food: Pick<FavoriteFood, 'grams' | 'kcal'>, t: T): string; // grams, not the portion label: USDA labels are long and English
```

Strings (add after the `library.*` block; zh / en):

| Key | zh | en |
|---|---|---|
| `library.group.mine` | 我的 | Mine |
| `library.about.mine` | 你收藏的食物和存下的餐，点 ＋ 加到今天 | Foods you starred and meals you saved. Tap + to add to today |
| `library.mine.empty` | 还没有收藏。在任意食物的页面点「☆ 收藏」，它就会出现在这里 | Nothing starred yet. Tap "☆ Star" on any food and it shows up here |
| `library.mine.value` | {amount} · {kcal} 千卡 | {amount} · {kcal} kcal |
| `library.mine.add` | 把{food}加到{meal} | Add {food} to {meal} |
| `library.mine.added` | 已加到{meal}：{food} | Added to {meal}: {food} |
| `favorite.add` | 收藏 | Star |
| `favorite.remove` | 已收藏 | Starred |
| `favorite.error` | 没能更新收藏 | Could not update the star |

Reuse existing keys: `templates.title`, `templates.items`, `templates.addLabel`, `report.kcal`, `recent.error`, `recent.added`, `library.loadError`.

- [ ] **Step 1: Write the failing tests**

```ts
const t = (key: MessageKey, vars?: Record<string, string | number>) => translate('zh', key, vars); // same helper style as plate-view.test.ts

describe('initialTab', () => {
  it('opens on 我的 only when it has something', () => {
    expect(initialTab(0, 0)).toBe('carbs');
    expect(initialTab(1, 0)).toBe('mine');
    expect(initialTab(0, 2)).toBe('mine');
  });
});
describe('LIBRARY_TABS', () => {
  it('puts 我的 first', () => expect(LIBRARY_TABS).toEqual(['mine', ...LIBRARY_GROUPS]));
});
describe('favoriteName', () => {
  it('uses the library short name when there is a picture', () => {
    expect(favoriteName({ name: 'Egg, whole, cooked, hard-boiled', nameZh: '水煮蛋（全蛋）', libraryKey: 'egg' }, 'zh')).toBe('水煮蛋');
    expect(favoriteName({ name: 'Egg, whole, cooked, hard-boiled', nameZh: '水煮蛋（全蛋）', libraryKey: 'egg' }, 'en')).toBe('Egg');
  });
  it('strips the bracket note of other foods and falls back to the English name', () => {
    expect(favoriteName({ name: 'Tuna, canned in water', nameZh: '水浸金枪鱼罐头（沥干）', libraryKey: null }, 'zh')).toBe('水浸金枪鱼罐头');
    expect(favoriteName({ name: 'Tuna, canned in water', nameZh: '水浸金枪鱼罐头（沥干）', libraryKey: null }, 'en')).toBe('Tuna, canned in water');
    expect(favoriteName({ name: '妈妈的红烧肉', nameZh: null, libraryKey: null }, 'zh')).toBe('妈妈的红烧肉');
  });
});
describe('favoriteInitial', () => {
  it('is one whole character', () => {
    expect(favoriteInitial('鸡胸肉')).toBe('鸡');
    expect(favoriteInitial('tuna')).toBe('T');
    expect(favoriteInitial('  豆腐')).toBe('豆');
    expect(favoriteInitial('🍜拉面')).toBe('🍜');
    expect(favoriteInitial('')).toBe('');
  });
});
describe('favoriteValue', () => {
  it('shows the amount and its kcal', () => {
    expect(favoriteValue({ grams: 100, kcal: 155.6 }, t)).toBe('100 克 · 156 千卡');
    expect(favoriteValue({ grams: 37.5, kcal: 195 }, t)).toBe('37.5 克 · 195 千卡');
  });
  it('shows only the amount when kcal is unknown', () => {
    expect(favoriteValue({ grams: 100, kcal: null }, t)).toBe('100 克');
  });
});
```

- [ ] **Step 2: Run and see them fail**

Run: `cd apps/mobile && pnpm exec jest favorites-view`
Expected: FAIL, cannot find module `./favorites-view`.

- [ ] **Step 3: Add the type, the strings and `favorites-view.ts`**

`favoriteName`: with a `libraryKey` → `shortName({ key: libraryKey, nameZh }, locale)`; otherwise zh with `nameZh` → the name without a trailing `（…）`; otherwise `name`. `favoriteInitial` iterates by code point (`[...name.trim()][0]`) and upper-cases it. `favoriteValue`: amount = `t('common.grams', { n: formatNumber(grams) })`, kcal rounded with `Math.round`, joined by `library.mine.value`.

- [ ] **Step 4: Run the tests**

Run: `cd apps/mobile && pnpm exec jest`
Expected: all suites PASS, including `i18n.test.ts` (same keys and placeholders in both languages).

- [ ] **Step 5: Leave the changes uncommitted.**

---

### Task 3: Mobile — 收藏 on the food page

**Files:**
- Modify: `apps/mobile/src/app/food/[id].tsx`

**Interfaces:**
- Consumes: `food.favorite` from `GET /api/foods/:id`; `api.api.foods[':id'].favorite.$put` / `.$delete`; `favorite.add`, `favorite.remove`, `favorite.error`.
- Produces: nothing for later tasks.

- [ ] **Step 1: Add the toggle**

- A pressable row directly under the plate-slot line: Ionicons `star-outline` + `t('favorite.add')` when not starred, `star` (color `tokens.color.primary`) + `t('favorite.remove')` when starred. `accessibilityRole="button"`, `accessibilityState={{ selected }}`, min height `tokens.touchTarget`.
- State `favorite: boolean | null`, filled on load the same way `amount` is (`current ?? body.food.favorite`), so returning from the custom-food form does not overwrite a tap.
- On press: flip the state at once, then `call('favorite.error', …)` with PUT or DELETE through the existing `runExclusive` guard. On `failed`: flip back and `setError(out.failure)` (the page's existing `ErrorText` shows it).

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Leave the changes uncommitted.**

---

### Task 4: Mobile — 「我的」 group in the food library tab

**Files:**
- Create: `apps/mobile/src/components/my-library.tsx`
- Modify: `apps/mobile/src/app/(tabs)/library.tsx`
- Modify: `docs/superpowers/specs/2026-11-22-my-food-library-design.md` (status line), `CLAUDE.md` (现状 + 下一步候选 5)

**Interfaces:**
- Consumes: `LIBRARY_TABS`, `LibraryTab`, `initialTab`, `favoriteName`, `favoriteInitial`, `favoriteValue` (Task 2); `FavoriteFood`, `MealTemplate` (`diary/api-types.ts`); `mealAt` (`library/library-view.ts`); `localDate` (`diary/dates.ts`); `SLOT_COLORS` (`components/meal-plate.tsx`); `LIBRARY_IMAGES`; `withJson`; `createInFlightGuard`; `ListRow`, `Card`, `CardHeader`, `ErrorText`.
- Produces:

```ts
// my-library.tsx
export function MyLibrary(props: { favorites: FavoriteFood[]; templates: MealTemplate[] }): JSX.Element;
```

- [ ] **Step 1: Load favorites and saved meals in `library.tsx`**

- `load` requests the library, `api.api.foods.favorites.$get()` and `api.api['meal-templates'].$get()` together (each through `call('library.loadError', …)`); any `failed` → the existing error state with retry; `ready` now holds `{ foods, favorites, templates }`.
- The selected tab is `LibraryTab | null`, null until the first successful load, then `initialTab(favorites.length, templates.length)`. Later reloads (tab focus) never change the selected tab.
- Chips iterate `LIBRARY_TABS`. While 「我的」 is selected the subtitle `library.subtitle` is not rendered; the per-tab line shows `library.about.mine`.
- 「我的」 renders `<MyLibrary …/>`; the other tabs are unchanged.

- [ ] **Step 2: Build `MyLibrary`**

- Nothing starred → `library.mine.empty` where the grid would be (same muted style as `library.groupEmpty`); saved meals, if any, still show below it.
- Favorites: a `Card` with the same 3-column grid math as `library.tsx` (move `COLUMNS`, `IMAGE_SIZE` and the tile styles somewhere both can import rather than copying them). Tile = picture, name (`favoriteName`, up to two lines), `favoriteValue` (one line, `adjustsFontSizeToFit`, `minimumFontScale={0.7}`).
  - Picture: `LIBRARY_IMAGES[libraryKey]` when it exists; otherwise a circle of `IMAGE_SIZE` filled with `SLOT_COLORS[food.slot]` holding `favoriteInitial(name)` in `tokens.color.onPrimary`.
  - Pressing the tile opens `/food/[id]` with today's date and `mealAt(new Date())`, like the other groups.
  - A round "＋" button in the tile's top-right corner (a sibling of the tile's pressable, not nested inside it; `hitSlop`, label `library.mine.add`). After a successful add it shows a checkmark on `tokens.color.primary`, the same look as `RecentRow` in `quick-picks.tsx`.
- Saved meals, below the grid, only when there are any: `Card` + `CardHeader label={t('templates.title')}` + one `ListRow` per template with the same title / subtitle / value / accessibility label as `quick-picks.tsx`.
- No saved meals: no 「我的餐」 header at all.
- Custom foods are not starred automatically; `createCustomFood` is not touched.

- [ ] **Step 3: One-tap add**

- Both actions run through one `createInFlightGuard()` and compute `date = localDate(new Date())` and `meal = mealAt(new Date())` **inside the handler**.
- Food: `api.api.diary.entries.$post({ json: { date, meal, foodId: food.id, portionId: food.portionId, quantity: food.quantity } })` via `call('recent.error', …)`.
- Saved meal: `api.api['meal-templates'][':id'].apply.$post(withJson({ id }, { date, meal }))` via `call('recent.error', …)`; stay on the tab (do not navigate to Today).
- On `ok`: remember the food id in an `added` set and show one line above the grid: `t('library.mine.added', { meal: t(\`meal.${meal}\`), food: name })` (for a saved meal, `food` is the template's name). The line stays until the next add or until the tab loses focus.
- On `failed`: clear that line and show `failureText(failure, t)` in an `ErrorText` at the same place; the tile keeps its "＋".

- [ ] **Step 4: Automated checks**

Run: `pnpm typecheck`
Expected: no errors.

Run: `cd apps/mobile && pnpm exec jest`
Expected: all suites PASS.

Run: `pnpm --filter @fitplan/api test`
Expected: all files PASS.

- [ ] **Step 5: Simulator — the main path** (iPhone 17; dev servers via `pnpm dev --no-open`, which applies migration `0007`; if Expo Go shows the old bundle, terminate it and reopen `exp://localhost:8081`). The simulator types English only: search with English names.

1. Food library opens on 「碳水」 for an account with no stars and no saved meals; 「我的」 shows the empty sentence.
2. Open a library food (e.g. egg) → tap 「☆ 收藏」 → it reads 「★ 已收藏」. Search "tuna" from Today's "+ 添加", open a result without a picture, star it.
3. Food library → 「我的」: both tiles, the pictured one with its image, the other with a colored circle and one character; third line shows amount · kcal; no subtitle about "每 100 克".
4. Leave the tab and come back: it still shows what was selected. Kill and reopen the app: the tab opens on 「我的」.
5. Tap "＋" on a tile twice quickly → one "✓", the line 「已加到<当前餐>：…」; Today shows exactly one new entry in that meal.
6. Save a meal from Today (「存为我的餐」), return: it is listed under 「我的餐」; tap it → the line appears and Today has its items.

- [ ] **Step 6: Simulator — edges**

1. Open a starred food, tap 「★ 已收藏」 → back in 「我的」 it is gone.
2. Stop the API (Ctrl+C in the dev task), tap "＋" → an error sentence appears, the tile still shows "＋". Restart the API.
3. Switch the language to English in 「我的」 page settings → chip reads "Mine", long USDA names take two lines and end with an ellipsis.
4. An account with a saved meal but no stars: 「我的」 shows the empty sentence and, below it, 「我的餐」.

Report which of these were actually seen; anything not seen is stated as not verified.

- [ ] **Step 7: Docs**

- Spec: status → 「已实施」 with what was and was not verified.
- `CLAUDE.md`: add the feature to 「未合并」 under 现状; rewrite 下一步候选 5 to say it is built (starred foods only; 常吃 stays in the search page).

- [ ] **Step 8: Leave everything uncommitted** and report to the owner in Chinese: what changed, why, what was verified.
