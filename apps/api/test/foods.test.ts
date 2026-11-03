import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { authed, seedUsdaFood, signedInUser, unique } from './helpers';

interface Summary {
  id: string;
  source: 'usda' | 'custom';
  name: string;
  nameZh: string | null;
  per100g: { kcal: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null };
}
interface Detail extends Summary {
  portions: { id: string; label: string | null; grams: number }[];
}

/** A token that appears in no other test's food names, so result lists are deterministic. */
const token = () => unique('tok').replaceAll('-', '').toLowerCase();

async function search(cookie: string, q: string, limit?: number): Promise<Summary[]> {
  const params = new URLSearchParams({ q, ...(limit ? { limit: String(limit) } : {}) });
  const res = await authed(cookie, 'GET', `/api/foods?${params}`);
  expect(res.status).toBe(200);
  return ((await res.json()) as { foods: Summary[] }).foods;
}

const bar = { name: 'Protein bar', servingLabel: '1 bar', servingGrams: 60, kcal: 210, proteinG: 20, carbsG: 24, fatG: 7 };

describe('GET /api/foods', () => {
  it('requires a session', async () => {
    expect((await authed('', 'GET', '/api/foods?q=rice')).status).toBe(401);
  });

  it('rejects an empty query', async () => {
    const { cookie } = await signedInUser();
    const res = await authed(cookie, 'GET', '/api/foods?q=%20%20');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_input', fields: { q: expect.any(String) } });
  });

  it('matches every word, in English, Chinese names and aliases', async () => {
    const { cookie } = await signedInUser();
    const t = token();
    const breast = await seedUsdaFood({ name: `Chicken ${t}, breast, roasted`, nameZh: `鸡胸${t}`, aliases: ['烤鸡'] });
    await seedUsdaFood({ name: `Chicken ${t}, thigh, roasted` });

    expect((await search(cookie, `${t} breast`)).map((f) => f.id)).toEqual([breast.id]);
    expect((await search(cookie, `BREAST ${t.toUpperCase()}`)).map((f) => f.id)).toEqual([breast.id]);
    expect((await search(cookie, `鸡胸${t}`)).map((f) => f.id)).toEqual([breast.id]);
    expect((await search(cookie, `烤鸡 ${t}`)).map((f) => f.id)).toEqual([breast.id]);
    expect(await search(cookie, `${t} wing`)).toEqual([]);
  });

  it('ranks exact names, then prefixes, then Chinese-named foods; own foods first within a tier', async () => {
    const { cookie } = await signedInUser();
    const t = token();
    const plain = await seedUsdaFood({ name: `Noodles ${t}, long description` });
    const zhNamed = await seedUsdaFood({ name: `Noodles ${t}, zh named`, nameZh: `面条 ${t}` });
    const prefix = await seedUsdaFood({ name: `${t} noodles, prefix` });
    const exactAlias = await seedUsdaFood({ name: `Noodles, ${t} alias`, aliases: [t] });
    const custom = await authed(cookie, 'POST', '/api/foods', { ...bar, name: `${t} my noodles` });
    const customId = ((await custom.json()) as { food: Detail }).food.id;

    expect((await search(cookie, t)).map((f) => f.id)).toEqual([
      exactAlias.id,
      customId,
      prefix.id,
      zhNamed.id,
      plain.id,
    ]);
    expect(await search(cookie, t, 2)).toHaveLength(2);
  });

  it('within a tier, a shown name starting with the query comes first', async () => {
    const { cookie } = await signedInUser();
    const t = token();
    // All three have the alias t (tier 0); only the longest name starts with it.
    const fried = await seedUsdaFood({ name: `Egg fried ${t}`, nameZh: `煎${t}`, aliases: [t] });
    const boiled = await seedUsdaFood({ name: `Egg boiled ${t}`, nameZh: `水煮${t}`, aliases: [t] });
    const raw = await seedUsdaFood({ name: `Egg raw ${t}`, nameZh: `${t}（生，带壳）`, aliases: [t] });
    expect((await search(cookie, t)).map((f) => f.id)).toEqual([raw.id, fried.id, boiled.id]);
  });

  it('escapes LIKE wildcards', async () => {
    const { cookie } = await signedInUser();
    const t = token();
    const percent = await seedUsdaFood({ name: `Juice ${t} 100% orange` });
    await seedUsdaFood({ name: `Juice ${t} 1000 orange` });
    const underscore = await seedUsdaFood({ name: `Juice ${t} a_b` });
    await seedUsdaFood({ name: `Juice ${t} axb` });

    expect((await search(cookie, `${t} 100%`)).map((f) => f.id)).toEqual([percent.id]);
    expect((await search(cookie, `${t} a_b`)).map((f) => f.id)).toEqual([underscore.id]);
  });
});

describe('GET /api/foods/:id', () => {
  it('returns per-100 g values and portions; unknown nutrients are null', async () => {
    const { cookie } = await signedInUser();
    const food = await seedUsdaFood({
      name: `Rice ${token()}`,
      kcal: 130,
      proteinG: null,
      portions: [
        { label: '1 cup', grams: 158 },
        { label: '0.5 cup', grams: 79 },
      ],
    });
    const res = await authed(cookie, 'GET', `/api/foods/${food.id}`);
    expect(res.status).toBe(200);
    const detail = ((await res.json()) as { food: Detail }).food;
    expect(detail).toMatchObject({ id: food.id, source: 'usda', per100g: { kcal: 130, proteinG: null } });
    expect(detail.portions).toEqual([
      { id: food.portionIds[0], label: '1 cup', grams: 158 },
      { id: food.portionIds[1], label: '0.5 cup', grams: 79 },
    ]);
  });

  it('404s for an unknown id', async () => {
    const { cookie } = await signedInUser();
    expect((await authed(cookie, 'GET', '/api/foods/usda-0')).status).toBe(404);
  });
});

describe('GET /api/foods/library', () => {
  async function addToLibrary(id: string, key: string, rank: number, extra: { fiberG?: number; alaG?: number; epaDhaG?: number }) {
    await env.DB.prepare(
      'UPDATE foods SET library_key = ?, library_rank = ?, fiber_g = ?, omega3_ala_g = ?, omega3_epa_dha_g = ? WHERE id = ?',
    )
      .bind(key, rank, extra.fiberG ?? null, extra.alaG ?? null, extra.epaDhaG ?? null, id)
      .run();
  }

  it('requires a session', async () => {
    expect((await authed('', 'GET', '/api/foods/library')).status).toBe(401);
  });

  it('lists library foods in csv order with their groups; other foods are left out', async () => {
    const { cookie } = await signedInUser();
    const t = token();
    const salmon = await seedUsdaFood({
      name: `Salmon ${t}`,
      category: 'Finfish and Shellfish Products',
      kcal: 206,
      proteinG: 22.1,
      carbsG: 0,
      fatG: 12.4,
    });
    const avocado = await seedUsdaFood({
      name: `Avocado ${t}`,
      category: 'Fruits and Fruit Juices',
      kcal: 160,
      proteinG: 2,
      carbsG: 8.5,
      fatG: 14.7,
    });
    const other = await seedUsdaFood({ name: `Not in library ${t}` });
    await addToLibrary(avocado.id, `avocado_${t}`, 2, { fiberG: 6.7 });
    await addToLibrary(salmon.id, `salmon_${t}`, 1, { epaDhaG: 2.15 });

    const res = await authed(cookie, 'GET', '/api/foods/library');
    expect(res.status).toBe(200);
    const foods = ((await res.json()) as { foods: (Summary & { key: string; groups: string[] })[] }).foods.filter((f) =>
      f.name.endsWith(t),
    );
    expect(foods.map((f) => f.id)).toEqual([salmon.id, avocado.id]);
    expect(foods.map((f) => f.id)).not.toContain(other.id);
    expect(foods[0]).toMatchObject({ key: `salmon_${t}`, groups: ['protein', 'omega3'], omega3EpaDhaG: 2.15 });
    expect(foods[1]).toMatchObject({ key: `avocado_${t}`, groups: ['fat', 'fruit', 'fiber'], fiberG: 6.7 });

    const detail = await authed(cookie, 'GET', `/api/foods/${salmon.id}`);
    expect(((await detail.json()) as { food: { libraryKey: string | null } }).food.libraryKey).toBe(`salmon_${t}`);
  });
});

describe('custom foods', () => {
  it('stores a nutrition label per 100 g with one serving portion', async () => {
    const { cookie } = await signedInUser();
    const res = await authed(cookie, 'POST', '/api/foods', bar);
    expect(res.status).toBe(201);
    const food = ((await res.json()) as { food: Detail }).food;
    expect(food.source).toBe('custom');
    expect(food.per100g.kcal).toBeCloseTo(350, 6);
    expect(food.per100g.proteinG).toBeCloseTo(33.333, 3);
    expect(food.portions).toEqual([{ id: expect.any(String), label: '1 bar', grams: 60 }]);
  });

  it('rejects invalid labels', async () => {
    const { cookie } = await signedInUser();
    const res = await authed(cookie, 'POST', '/api/foods', { ...bar, name: '', servingGrams: 10 });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { fields: Record<string, string> };
    expect(Object.keys(body.fields).sort()).toEqual(['name', 'servingGrams']);
  });

  it('can be edited and deleted by the owner only; USDA foods cannot', async () => {
    const owner = await signedInUser();
    const other = await signedInUser();
    const usda = await seedUsdaFood({ name: `Usda ${token()}` });
    const created = ((await (await authed(owner.cookie, 'POST', '/api/foods', bar)).json()) as { food: Detail }).food;
    const edit = { ...bar, name: 'Protein bar v2', servingLabel: null, servingGrams: 52.5 };

    expect((await authed(other.cookie, 'PUT', `/api/foods/${created.id}`, edit)).status).toBe(404);
    expect((await authed(other.cookie, 'DELETE', `/api/foods/${created.id}`)).status).toBe(404);
    expect((await authed(owner.cookie, 'PUT', `/api/foods/${usda.id}`, edit)).status).toBe(404);
    expect((await authed(owner.cookie, 'DELETE', `/api/foods/${usda.id}`)).status).toBe(404);
    const untouched = ((await (await authed(owner.cookie, 'GET', `/api/foods/${created.id}`)).json()) as { food: Detail }).food;
    expect(untouched).toMatchObject({ name: 'Protein bar', portions: [{ label: '1 bar', grams: 60 }] });

    const put = await authed(owner.cookie, 'PUT', `/api/foods/${created.id}`, edit);
    expect(put.status).toBe(200);
    const updated = ((await put.json()) as { food: Detail }).food;
    expect(updated).toMatchObject({ name: 'Protein bar v2', per100g: { kcal: 400 } });
    expect(updated.portions).toEqual([{ id: created.portions[0]?.id, label: null, grams: 52.5 }]);

    expect((await authed(owner.cookie, 'DELETE', `/api/foods/${created.id}`)).status).toBe(204);
    expect((await authed(owner.cookie, 'GET', `/api/foods/${created.id}`)).status).toBe(404);
  });

  it('custom foods are private', async () => {
    const owner = await signedInUser();
    const other = await signedInUser();
    const t = token();
    const created = ((await (await authed(owner.cookie, 'POST', '/api/foods', { ...bar, name: `Secret ${t}` })).json()) as {
      food: Detail;
    }).food;

    expect((await search(owner.cookie, t)).map((f) => f.id)).toEqual([created.id]);
    expect(await search(other.cookie, t)).toEqual([]);
    expect((await authed(other.cookie, 'GET', `/api/foods/${created.id}`)).status).toBe(404);
  });
});
