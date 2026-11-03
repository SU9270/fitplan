// Turns the USDA FoodData Central "SR Legacy" CSV download into rows for `foods` and
// `food_portions`, and those rows into idempotent SQL. Pure (no file system): the CLI in
// scripts/import-usda.ts reads the files and runs wrangler. See the phase 2 spec, section 2.
import { csvRecords } from './csv.ts';
import { ALIAS_SEPARATOR, buildSearchText } from './search-text.ts';

/** FDC `nutrient.id`s we keep (SR Legacy values are per 100 g of edible portion). */
export const FDC_NUTRIENT_IDS = {
  kcal: '1008',
  proteinG: '1003',
  fatG: '1004',
  carbsG: '1005',
  fiberG: '1079',
  sugarsG: '2000',
  sodiumMg: '1093',
} as const;

/**
 * Omega-3 nutrients for the library's omega-3 group. ALA is "18:3 n-3 c,c,c" where reported,
 * else total 18:3 (in plant foods almost all ALA); EPA and DHA are added up.
 */
export const FDC_OMEGA3_IDS = { ala: '1404', ala18_3Total: '1270', epa: '1278', dha: '1272' } as const;

type NutrientField = keyof typeof FDC_NUTRIENT_IDS;
const NUTRIENT_FIELD_BY_ID = new Map<string, NutrientField>(
  Object.entries(FDC_NUTRIENT_IDS).map(([field, id]) => [id, field as NutrientField]),
);

/** Raw text of the CSV files used from the SR Legacy download. */
export interface UsdaCsvFiles {
  food: string;
  foodCategory: string;
  srLegacyFood: string;
  foodNutrient: string;
  foodPortion: string;
  measureUnit: string;
}

export interface ZhName {
  ndbNumber: string;
  nameZh: string;
  aliases: string[];
  /** Label of the portion suggestions use (e.g. "1 large"); null = not a suggestion candidate. */
  suggestPortion: string | null;
  /** Image key of the food in the library tab (e.g. "salmon"); null = not in the library. */
  library: string | null;
}

/** Library keys name image files: lowercase letters, digits and underscores. */
const LIBRARY_KEY = /^[a-z][a-z0-9_]*$/;

export type UsdaFoodRow = {
  id: string;
  fdcId: number;
  name: string;
  nameZh: string | null;
  aliases: string | null;
  searchText: string;
  /** USDA food category description, e.g. "Vegetables and Vegetable Products". */
  category: string | null;
  suggestPortionId: string | null;
  omega3AlaG: number | null;
  omega3EpaDhaG: number | null;
  libraryKey: string | null;
  /** Position among the library rows of data/usda-zh.csv (0 = first). */
  libraryRank: number | null;
} & Record<NutrientField, number | null>;

export interface UsdaPortionRow {
  id: string;
  foodId: string;
  label: string;
  grams: number;
  sortOrder: number;
}

export interface UsdaImport {
  foods: UsdaFoodRow[];
  portions: UsdaPortionRow[];
  /** NDB numbers in the Chinese name table that are not in the download. */
  unmatchedNdbNumbers: string[];
  /** `suggest_portion` labels that match none of the food's portions ("<ndb>: <label>"). */
  unmatchedSuggestPortions: string[];
}

export const usdaFoodId = (fdcId: number) => `usda-${fdcId}`;
const usdaPortionId = (portionId: string) => `usda-portion-${portionId}`;

/** "01001" and "1001" are the same NDB number. */
const normalizeNdb = (ndb: string) => ndb.trim().replace(/^0+(?=\d)/, '');

/**
 * Reads apps/api/data/usda-zh.csv (`ndb_number,name_zh,aliases,suggest_portion,library`). Throws
 * on duplicates, blanks or a malformed library key.
 */
export function parseZhNames(text: string): ZhName[] {
  const names: ZhName[] = [];
  const seen = new Set<string>();
  const seenLibrary = new Set<string>();
  for (const r of csvRecords(text)) {
    const ndbNumber = (r.ndb_number ?? '').trim();
    const nameZh = (r.name_zh ?? '').trim();
    if (!/^\d{4,5}$/.test(ndbNumber)) throw new Error(`usda-zh: bad ndb_number "${ndbNumber}"`);
    if (nameZh === '') throw new Error(`usda-zh: empty name_zh for ${ndbNumber}`);
    const key = normalizeNdb(ndbNumber);
    if (seen.has(key)) throw new Error(`usda-zh: duplicate ndb_number ${ndbNumber}`);
    seen.add(key);
    const aliases = (r.aliases ?? '')
      .split(ALIAS_SEPARATOR)
      .map((a) => a.trim())
      .filter((a) => a !== '');
    const suggestPortion = (r.suggest_portion ?? '').trim();
    const library = (r.library ?? '').trim();
    if (library !== '') {
      if (!LIBRARY_KEY.test(library)) throw new Error(`usda-zh: bad library key "${library}" for ${ndbNumber}`);
      if (seenLibrary.has(library)) throw new Error(`usda-zh: duplicate library key ${library}`);
      seenLibrary.add(library);
    }
    names.push({
      ndbNumber,
      nameZh,
      aliases,
      suggestPortion: suggestPortion === '' ? null : suggestPortion,
      library: library === '' ? null : library,
    });
  }
  return names;
}

function parseAmount(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** 1 → "1", 0.5 → "0.5", 1.333 → "1.33". */
function formatAmount(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/**
 * "1 cup, chopped": amount + unit (skipped when FDC says "undetermined", as in all SR Legacy
 * rows) + description or modifier.
 */
export function portionLabel(amount: number | null, unitName: string | undefined, text: string): string {
  const unit = unitName && unitName !== 'undetermined' ? unitName : '';
  return [amount === null ? '' : formatAmount(amount), unit, text.trim()].filter((part) => part !== '').join(' ');
}

export function buildUsdaImport(files: UsdaCsvFiles, zhNames: readonly ZhName[]): UsdaImport {
  const zhByNdb = new Map(zhNames.map((z) => [normalizeNdb(z.ndbNumber), z]));
  const libraryRank = new Map(
    zhNames.filter((z) => z.library !== null).map((z, rank) => [normalizeNdb(z.ndbNumber), rank] as const),
  );
  const ndbByFdc = new Map<string, string>();
  for (const r of csvRecords(files.srLegacyFood)) ndbByFdc.set(r.fdc_id ?? '', normalizeNdb(r.NDB_number ?? ''));

  const categories = new Map<string, string>();
  for (const r of csvRecords(files.foodCategory)) categories.set(r.id ?? '', (r.description ?? '').trim());

  const foodsByFdc = new Map<string, UsdaFoodRow>();
  const zhByFoodId = new Map<string, ZhName>();
  const matchedNdb = new Set<string>();
  for (const r of csvRecords(files.food)) {
    const fdc = r.fdc_id ?? '';
    const fdcId = Number(fdc);
    const name = (r.description ?? '').trim();
    // food.csv of other downloads lists other data types too; keep SR Legacy foods only.
    if (!ndbByFdc.has(fdc) || !Number.isInteger(fdcId) || name === '') continue;
    const zh = zhByNdb.get(ndbByFdc.get(fdc) ?? '');
    if (zh) {
      matchedNdb.add(normalizeNdb(zh.ndbNumber));
      zhByFoodId.set(usdaFoodId(fdcId), zh);
    }
    foodsByFdc.set(fdc, {
      id: usdaFoodId(fdcId),
      fdcId,
      name,
      nameZh: zh?.nameZh ?? null,
      aliases: zh && zh.aliases.length > 0 ? zh.aliases.join(ALIAS_SEPARATOR) : null,
      searchText: buildSearchText(name, zh?.nameZh ?? null, zh?.aliases ?? []),
      category: categories.get(r.food_category_id ?? '') || null,
      suggestPortionId: null,
      omega3AlaG: null,
      omega3EpaDhaG: null,
      libraryKey: zh?.library ?? null,
      libraryRank: libraryRank.get(ndbByFdc.get(fdc) ?? '') ?? null,
      kcal: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
      fiberG: null,
      sugarsG: null,
      sodiumMg: null,
    });
  }

  const omega3 = new Map<string, Partial<Record<keyof typeof FDC_OMEGA3_IDS, number>>>();
  const omega3KeyById = new Map<string, keyof typeof FDC_OMEGA3_IDS>(Object.entries(FDC_OMEGA3_IDS).map(([key, id]) => [id, key as keyof typeof FDC_OMEGA3_IDS]));
  for (const r of csvRecords(files.foodNutrient)) {
    const id = r.nutrient_id ?? '';
    const field = NUTRIENT_FIELD_BY_ID.get(id);
    const omega3Key = omega3KeyById.get(id);
    const food = field || omega3Key ? foodsByFdc.get(r.fdc_id ?? '') : undefined;
    const amount = parseAmount(r.amount);
    if (!food || amount === null || amount < 0) continue;
    if (field) food[field] = amount;
    if (omega3Key) omega3.set(food.id, { ...omega3.get(food.id), [omega3Key]: amount });
  }
  for (const food of foodsByFdc.values()) {
    const o = omega3.get(food.id);
    if (!o) continue;
    food.omega3AlaG = o.ala ?? o.ala18_3Total ?? null;
    food.omega3EpaDhaG = o.epa === undefined && o.dha === undefined ? null : (o.epa ?? 0) + (o.dha ?? 0);
  }

  const unitNames = new Map<string, string>();
  for (const r of csvRecords(files.measureUnit)) unitNames.set(r.id ?? '', r.name ?? '');

  const portions: UsdaPortionRow[] = [];
  for (const r of csvRecords(files.foodPortion)) {
    const food = foodsByFdc.get(r.fdc_id ?? '');
    const grams = parseAmount(r.gram_weight);
    if (!food || grams === null || grams <= 0 || !r.id) continue;
    const label = portionLabel(
      parseAmount(r.amount),
      unitNames.get(r.measure_unit_id ?? ''),
      r.portion_description || r.modifier || '',
    );
    if (label === '') continue;
    portions.push({ id: usdaPortionId(r.id), foodId: food.id, label, grams, sortOrder: parseAmount(r.seq_num) ?? 0 });
  }

  // Resolve each curated suggestion portion label to the food's portion id.
  const unmatchedSuggestPortions: string[] = [];
  for (const food of foodsByFdc.values()) {
    const wanted = zhByFoodId.get(food.id)?.suggestPortion;
    if (!wanted) continue;
    const portion = portions.find((p) => p.foodId === food.id && p.label === wanted);
    if (portion) food.suggestPortionId = portion.id;
    else unmatchedSuggestPortions.push(`${zhByFoodId.get(food.id)?.ndbNumber}: ${wanted}`);
  }

  return {
    foods: [...foodsByFdc.values()],
    portions,
    unmatchedNdbNumbers: zhNames.map((z) => z.ndbNumber).filter((ndb) => !matchedNdb.has(normalizeNdb(ndb))),
    unmatchedSuggestPortions,
  };
}

function sqlValue(value: string | number | null): string {
  if (value === null) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`not a finite number: ${value}`);
    return String(value);
  }
  return `'${value.replaceAll("'", "''")}'`;
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Rows per INSERT: keeps each statement well under D1's statement size limit. */
const ROWS_PER_STATEMENT = 100;

/**
 * Idempotent SQL: foods and portions are upserted by their stable FDC-derived ids, so running
 * the import again updates rows in place (diary entries keep pointing at the same portions)
 * and never touches custom foods.
 */
export function toImportSql(data: Pick<UsdaImport, 'foods' | 'portions'>, now: string): string[] {
  // Library keys are unique: clear them first so moving a key to another food cannot collide.
  const statements: string[] = [
    "UPDATE foods SET library_key = NULL, library_rank = NULL WHERE source = 'usda_sr_legacy' AND library_key IS NOT NULL;",
  ];
  for (const batch of chunks(data.foods, ROWS_PER_STATEMENT)) {
    const values = batch.map((f) =>
      [
        f.id,
        'usda_sr_legacy',
        f.fdcId,
        null,
        f.name,
        f.nameZh,
        f.aliases,
        f.searchText,
        f.category,
        f.suggestPortionId,
        f.kcal,
        f.proteinG,
        f.carbsG,
        f.fatG,
        f.fiberG,
        f.sugarsG,
        f.sodiumMg,
        f.omega3AlaG,
        f.omega3EpaDhaG,
        f.libraryKey,
        f.libraryRank,
        now,
        now,
      ].map(sqlValue),
    );
    statements.push(
      'INSERT INTO foods (id, source, fdc_id, owner_user_id, name, name_zh, aliases, search_text, category, suggest_portion_id, kcal, protein_g, carbs_g, fat_g, fiber_g, sugars_g, sodium_mg, omega3_ala_g, omega3_epa_dha_g, library_key, library_rank, created_at, updated_at) VALUES\n' +
        values.map((v) => `(${v.join(', ')})`).join(',\n') +
        '\nON CONFLICT(id) DO UPDATE SET name = excluded.name, name_zh = excluded.name_zh, aliases = excluded.aliases, ' +
        'search_text = excluded.search_text, category = excluded.category, suggest_portion_id = excluded.suggest_portion_id, kcal = excluded.kcal, protein_g = excluded.protein_g, carbs_g = excluded.carbs_g, ' +
        'fat_g = excluded.fat_g, fiber_g = excluded.fiber_g, sugars_g = excluded.sugars_g, sodium_mg = excluded.sodium_mg, ' +
        'omega3_ala_g = excluded.omega3_ala_g, omega3_epa_dha_g = excluded.omega3_epa_dha_g, library_key = excluded.library_key, library_rank = excluded.library_rank, ' +
        'updated_at = excluded.updated_at;',
    );
  }
  for (const batch of chunks(data.portions, ROWS_PER_STATEMENT)) {
    const values = batch.map((p) => [p.id, p.foodId, p.label, p.grams, p.sortOrder].map(sqlValue));
    statements.push(
      'INSERT INTO food_portions (id, food_id, label, grams, sort_order) VALUES\n' +
        values.map((v) => `(${v.join(', ')})`).join(',\n') +
        '\nON CONFLICT(id) DO UPDATE SET food_id = excluded.food_id, label = excluded.label, grams = excluded.grams, ' +
        'sort_order = excluded.sort_order;',
    );
  }
  return statements;
}
