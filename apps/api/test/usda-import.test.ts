import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import zhCsv from '../data/usda-zh.csv?raw';
import { buildUsdaImport, parseZhNames, portionLabel, toImportSql, type UsdaCsvFiles } from '../src/foods/usda-import';
import { unique } from './helpers';

// Synthetic rows in the layout of the FoodData Central SR Legacy CSV download (every field
// quoted, columns as in the real files). The numbers are made up for the test, not USDA data.
const files: UsdaCsvFiles = {
  food: [
    '"fdc_id","data_type","description","food_category_id","publication_date"',
    '"900001","sr_legacy_food","Test chicken, roasted","5","2019-04-01"',
    '"900002","sr_legacy_food","Test sauce, ""special""","6","2019-04-01"',
    '"900003","foundation_food","Not an SR Legacy food","5","2020-01-01"',
  ].join('\n'),
  foodCategory: ['"id","code","description"', '"5","0500","Poultry Products"', '"6","0600","Soups, Sauces, and Gravies"'].join('\n'),
  srLegacyFood: ['"fdc_id","NDB_number"', '"900001","5064"', '"900002","06176"'].join('\n'),
  foodNutrient: [
    '"id","fdc_id","nutrient_id","amount","data_points","derivation_id","min","max","median","footnote","min_year_acquired"',
    '"1","900001","1008","160","","","","","","",""',
    '"2","900001","1003","30.5","","","","","","",""',
    '"3","900001","1004","3.5","","","","","","",""',
    '"4","900001","1005","0","","","","","","",""',
    '"5","900001","1093","74","","","","","","",""',
    '"6","900001","1018","1.2","","","","","","",""',
    '"7","900002","1008","51","","","","","","",""',
    '"8","900002","1005","","","","","","","",""',
    '"9","900003","1008","999","","","","","","",""',
    '"10","900001","1270","0.5","","","","","","",""',
    '"11","900001","1404","0.3","","","","","","",""',
    '"12","900001","1278","0.02","","","","","","",""',
    '"13","900001","1272","0.05","","","","","","",""',
    '"14","900002","1270","0.9","","","","","","",""',
  ].join('\n'),
  foodPortion: [
    '"id","fdc_id","seq_num","amount","measure_unit_id","portion_description","modifier","gram_weight","data_points","footnote","min_year_acquired"',
    '"80001","900001","1","1","9999","","cup, chopped or diced","140","","",""',
    '"80002","900001","2","0.5","9999","","breast, bone and skin removed","86","","",""',
    '"80003","900002","1","1","9999","","tbsp","0","","",""',
    '"80004","900002","2","1","1000","","","18","","",""',
  ].join('\n'),
  measureUnit: ['"id","name"', '"1000","cup"', '"9999","undetermined"'].join('\n'),
};

const zh = parseZhNames(
  'ndb_number,name_zh,aliases,suggest_portion,library\n05064,测试鸡胸,鸡胸| chicken breast ,"0.5 breast, bone and skin removed",test_chicken\n99999,不存在,,,\n',
);

describe('parseZhNames', () => {
  it('reads names and trims aliases', () => {
    expect(zh[0]).toEqual({
      ndbNumber: '05064',
      nameZh: '测试鸡胸',
      aliases: ['鸡胸', 'chicken breast'],
      suggestPortion: '0.5 breast, bone and skin removed',
      library: 'test_chicken',
    });
    expect(zh[1]).toMatchObject({ aliases: [], suggestPortion: null, library: null });
  });

  it('rejects duplicates (with or without leading zeros) and blank names', () => {
    expect(() => parseZhNames('ndb_number,name_zh,aliases\n05064,a,\n5064,b,\n')).toThrow(/duplicate/);
    expect(() => parseZhNames('ndb_number,name_zh,aliases\n05064, ,\n')).toThrow(/empty name_zh/);
    expect(() => parseZhNames('ndb_number,name_zh,aliases\nabc,a,\n')).toThrow(/bad ndb_number/);
  });

  it('rejects malformed and duplicate library keys', () => {
    expect(() => parseZhNames('ndb_number,name_zh,library\n05064,a,Salmon\n')).toThrow(/bad library key/);
    expect(() => parseZhNames('ndb_number,name_zh,library\n05064,a,fish\n05065,b,fish\n')).toThrow(/duplicate library key/);
  });

  it('the shipped table is well-formed', () => {
    const names = parseZhNames(zhCsv);
    expect(names.length).toBeGreaterThan(200);
    expect(names.filter((n) => n.suggestPortion !== null).length).toBeGreaterThan(20);
    expect(names.filter((n) => n.library !== null).length).toBeGreaterThanOrEqual(50);
    for (const name of names) expect(name.aliases.every((a) => a === a.trim() && a !== '')).toBe(true);
  });
});

describe('portionLabel', () => {
  it('drops the "undetermined" unit and formats the amount', () => {
    expect(portionLabel(1, 'undetermined', 'cup, chopped')).toBe('1 cup, chopped');
    expect(portionLabel(0.5, 'cup', '')).toBe('0.5 cup');
    expect(portionLabel(1 / 3, undefined, 'slice')).toBe('0.33 slice');
    expect(portionLabel(null, undefined, 'large')).toBe('large');
  });
});

describe('buildUsdaImport', () => {
  const data = buildUsdaImport(files, zh);

  it('keeps SR Legacy foods only and maps the nutrients (missing → null, others ignored)', () => {
    expect(data.foods.map((f) => f.id)).toEqual(['usda-900001', 'usda-900002']);
    expect(data.foods[0]).toMatchObject({
      fdcId: 900001,
      name: 'Test chicken, roasted',
      kcal: 160,
      proteinG: 30.5,
      fatG: 3.5,
      carbsG: 0,
      sodiumMg: 74,
      fiberG: null,
      sugarsG: null,
    });
    expect(data.foods[1]).toMatchObject({ name: 'Test sauce, "special"', kcal: 51, carbsG: null, proteinG: null });
  });

  it('reads omega-3: ALA (else total 18:3) and EPA + DHA added up', () => {
    expect(data.foods[0]?.omega3AlaG).toBe(0.3);
    expect(data.foods[0]?.omega3EpaDhaG).toBeCloseTo(0.07);
    expect(data.foods[1]).toMatchObject({ omega3AlaG: 0.9, omega3EpaDhaG: null });
  });

  it('marks library foods with their key and the order of the csv rows', () => {
    expect(data.foods[0]).toMatchObject({ libraryKey: 'test_chicken', libraryRank: 0 });
    expect(data.foods[1]).toMatchObject({ libraryKey: null, libraryRank: null });
  });

  it('keeps the USDA category and resolves the suggestion portion by its label', () => {
    expect(data.foods[0]).toMatchObject({ category: 'Poultry Products', suggestPortionId: 'usda-portion-80002' });
    expect(data.foods[1]).toMatchObject({ category: 'Soups, Sauces, and Gravies', suggestPortionId: null });
    expect(data.unmatchedSuggestPortions).toEqual([]);
  });

  it('reports suggestion portion labels that match no portion', () => {
    const typo = parseZhNames('ndb_number,name_zh,aliases,suggest_portion\n05064,测试鸡胸,,1 breast\n');
    const result = buildUsdaImport(files, typo);
    expect(result.unmatchedSuggestPortions).toEqual(['05064: 1 breast']);
    expect(result.foods[0]?.suggestPortionId).toBeNull();
  });

  it('applies Chinese names by NDB number and builds the search text', () => {
    expect(data.foods[0]).toMatchObject({
      nameZh: '测试鸡胸',
      aliases: '鸡胸|chicken breast',
      searchText: 'test chicken, roasted\n测试鸡胸\n鸡胸\nchicken breast',
    });
    expect(data.foods[1]).toMatchObject({ nameZh: null, aliases: null, searchText: 'test sauce, "special"' });
    expect(data.unmatchedNdbNumbers).toEqual(['99999']);
  });

  it('builds portion labels and drops portions without a positive weight', () => {
    expect(data.portions).toEqual([
      { id: 'usda-portion-80001', foodId: 'usda-900001', label: '1 cup, chopped or diced', grams: 140, sortOrder: 1 },
      { id: 'usda-portion-80002', foodId: 'usda-900001', label: '0.5 breast, bone and skin removed', grams: 86, sortOrder: 2 },
      { id: 'usda-portion-80004', foodId: 'usda-900002', label: '1 cup', grams: 18, sortOrder: 2 },
    ]);
  });
});

describe('toImportSql', () => {
  async function run(statements: string[]) {
    for (const statement of statements) await env.DB.prepare(statement).run();
  }

  it('can run twice: rows are updated in place and custom foods are untouched', async () => {
    const data = buildUsdaImport(files, zh);
    const ownerId = unique('owner');
    await env.DB.prepare('INSERT INTO user (id, name, email) VALUES (?, ?, ?)').bind(ownerId, 'o', `${ownerId}@example.com`).run();
    await env.DB.prepare(
      "INSERT INTO foods (id, source, owner_user_id, name, search_text) VALUES (?, 'custom', ?, 'My bar', 'my bar')",
    )
      .bind(`custom-${ownerId}`, ownerId)
      .run();

    await run(toImportSql(data, '2026-11-02T00:00:00.000Z'));
    // The second run also moves the library key to the other food (keys are unique).
    const renamed = {
      ...data,
      foods: data.foods.map((f) => ({
        ...f,
        nameZh: f.nameZh && `${f.nameZh}2`,
        libraryKey: f.libraryKey === null ? 'test_chicken' : null,
        libraryRank: f.libraryKey === null ? 0 : null,
      })),
    };
    await run(toImportSql(renamed, '2026-11-03T00:00:00.000Z'));

    const foods = await env.DB.prepare(
      "SELECT id, name, name_zh, category, suggest_portion_id, kcal, carbs_g, created_at, updated_at FROM foods WHERE id LIKE 'usda-9000%' ORDER BY id",
    ).all();
    expect(foods.results).toEqual([
      { id: 'usda-900001', name: 'Test chicken, roasted', name_zh: '测试鸡胸2', category: 'Poultry Products', suggest_portion_id: 'usda-portion-80002', kcal: 160, carbs_g: 0, created_at: '2026-11-02T00:00:00.000Z', updated_at: '2026-11-03T00:00:00.000Z' },
      { id: 'usda-900002', name: 'Test sauce, "special"', name_zh: null, category: 'Soups, Sauces, and Gravies', suggest_portion_id: null, kcal: 51, carbs_g: null, created_at: '2026-11-02T00:00:00.000Z', updated_at: '2026-11-03T00:00:00.000Z' },
    ]);
    const library = await env.DB.prepare(
      "SELECT id, library_key, library_rank, omega3_ala_g FROM foods WHERE id LIKE 'usda-9000%' ORDER BY id",
    ).all();
    expect(library.results).toEqual([
      { id: 'usda-900001', library_key: null, library_rank: null, omega3_ala_g: 0.3 },
      { id: 'usda-900002', library_key: 'test_chicken', library_rank: 0, omega3_ala_g: 0.9 },
    ]);
    const portions = await env.DB.prepare("SELECT count(*) AS n FROM food_portions WHERE food_id LIKE 'usda-9000%'").first<{ n: number }>();
    expect(portions?.n).toBe(3);
    const custom = await env.DB.prepare('SELECT name FROM foods WHERE id = ?').bind(`custom-${ownerId}`).first();
    expect(custom).toEqual({ name: 'My bar' });
  });
});
