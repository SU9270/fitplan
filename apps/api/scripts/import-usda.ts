// Import the USDA FoodData Central "SR Legacy" foods into the D1 database.
//
//   1. Download "SR Legacy" (CSV) from https://fdc.nal.usda.gov/download-datasets and unzip it.
//   2. pnpm --filter @fitplan/api food:import -- --dir <unzipped folder>            # local database
//      pnpm --filter @fitplan/api food:import -- --dir <unzipped folder> --remote   # deployed database
//
// Safe to run again: rows are upserted by their FDC ids and custom foods are never touched.
// The local database gets its pending migrations applied first (the import writes columns that
// newer migrations add). The deployed database is never migrated from here: run
// `pnpm db:migrate:remote` yourself before `--remote`.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { buildUsdaImport, parseZhNames, toImportSql } from '../src/foods/usda-import.ts';

const DATABASE_NAME = 'fitplan';
const API_DIR = fileURLToPath(new URL('..', import.meta.url));
const FILES = {
  food: 'food.csv',
  foodCategory: 'food_category.csv',
  srLegacyFood: 'sr_legacy_food.csv',
  foodNutrient: 'food_nutrient.csv',
  foodPortion: 'food_portion.csv',
  measureUnit: 'measure_unit.csv',
} as const;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** The zip unpacks into a dated sub-folder; accept either that folder or its parent. */
function resolveDataDir(dir: string): string {
  if (existsSync(path.join(dir, FILES.food))) return dir;
  for (const name of readdirSync(dir)) {
    const sub = path.join(dir, name);
    if (statSync(sub).isDirectory() && existsSync(path.join(sub, FILES.food))) return sub;
  }
  return fail(`No ${FILES.food} in ${dir} (or a folder directly inside it). Did you unzip the SR Legacy CSV download?`);
}

// pnpm forwards the `--` separator; drop it so the flags after it are parsed.
const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    dir: { type: 'string' },
    zh: { type: 'string', default: path.join(API_DIR, 'data', 'usda-zh.csv') },
    remote: { type: 'boolean', default: false },
  },
});
if (!values.dir) fail('Usage: food:import -- --dir <unzipped SR Legacy CSV folder> [--remote]');

// `pnpm --filter` runs this from apps/api; resolve relative paths against the folder the
// command was typed in (pnpm sets INIT_CWD to it), so `--dir ../data` means what it says.
const invokedFrom = process.env.INIT_CWD ?? process.cwd();
const dataDir = resolveDataDir(path.resolve(invokedFrom, values.dir));
const read = (file: string) => readFileSync(path.join(dataDir, file), 'utf8');
const files = Object.fromEntries(Object.entries(FILES).map(([key, file]) => [key, read(file)])) as Record<
  keyof typeof FILES,
  string
>;

const data = buildUsdaImport(files, parseZhNames(readFileSync(path.resolve(invokedFrom, values.zh), 'utf8')));
if (data.foods.length === 0) fail(`No SR Legacy foods found in ${dataDir}.`);
const named = data.foods.filter((f) => f.nameZh !== null).length;
console.log(`Foods: ${data.foods.length} (${named} with a Chinese name), portions: ${data.portions.length}`);
if (data.unmatchedSuggestPortions.length > 0) {
  fail(
    `data/usda-zh.csv suggest_portion labels without a matching portion (fix the label):\n  ${data.unmatchedSuggestPortions.join('\n  ')}`,
  );
}
const suggestable = data.foods.filter((f) => f.suggestPortionId !== null).length;
console.log(`Suggestion candidates: ${suggestable}`);
if (data.unmatchedNdbNumbers.length > 0) {
  console.warn(`Chinese names without a matching food (check data/usda-zh.csv): ${data.unmatchedNdbNumbers.join(', ')}`);
}

if (!values.remote) {
  // CI=1 answers wrangler's "apply these migrations?" prompt.
  const migrated = spawnSync('pnpm', ['exec', 'wrangler', 'd1', 'migrations', 'apply', DATABASE_NAME, '--local'], {
    cwd: API_DIR,
    env: { ...process.env, CI: '1' },
    encoding: 'utf8',
  });
  if (migrated.status !== 0) {
    process.stdout.write(migrated.stdout ?? '');
    process.stderr.write(migrated.stderr ?? '');
    fail('Applying the local database migrations failed (output above).');
  }
  console.log('Local database migrations are up to date.');
}

const workDir = mkdtempSync(path.join(tmpdir(), 'fitplan-usda-'));
const sqlFile = path.join(workDir, 'import.sql');
writeFileSync(sqlFile, toImportSql(data, new Date().toISOString()).join('\n'));

const result = spawnSync(
  'pnpm',
  ['exec', 'wrangler', 'd1', 'execute', DATABASE_NAME, values.remote ? '--remote' : '--local', '--file', sqlFile, '--yes'],
  { cwd: API_DIR, stdio: 'inherit' },
);
rmSync(workDir, { recursive: true, force: true });
if (result.status !== 0) {
  fail(
    values.remote
      ? 'wrangler d1 execute failed; see the output above. If a column or table is missing, run `pnpm db:migrate:remote` first.'
      : 'wrangler d1 execute failed; see the output above.',
  );
}
console.log(`Imported into the ${values.remote ? 'remote' : 'local'} database.`);
