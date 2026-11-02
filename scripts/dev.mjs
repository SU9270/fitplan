// One command for local development: `pnpm dev` from the repo root.
//
//   pnpm dev              backend + app, opens the iOS simulator
//   pnpm dev --android    backend + app, opens the Android emulator
//   pnpm dev --no-open    backend + app, opens nothing (press i / a in the Expo prompt later)
//
// First it prepares what a fresh clone lacks (each step is skipped when already done):
// apps/api/.dev.vars with a random secret, apps/mobile/.env, and pending local D1 migrations.
// Then it starts the API (`wrangler dev`, logs prefixed with [api]), waits until it answers,
// and runs Expo in the foreground so its key shortcuts (r, i, a, …) keep working.
// Ctrl+C stops both.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const API_VARS = `${ROOT}apps/api/.dev.vars`;
const API_VARS_EXAMPLE = `${ROOT}apps/api/.dev.vars.example`;
const APP_ENV = `${ROOT}apps/mobile/.env`;
const APP_ENV_EXAMPLE = `${ROOT}apps/mobile/.env.example`;
const API_HEALTH = 'http://localhost:8787/health';
/** The Android emulator's alias for the computer it runs on. */
const ANDROID_API_URL = 'http://10.0.2.2:8787';
const API_START_TIMEOUT_MS = 60_000;

const args = new Set(process.argv.slice(2).filter((arg) => arg !== '--'));
const target = args.has('--no-open') ? 'none' : args.has('--android') ? 'android' : 'ios';

const say = (message) => console.log(`\x1b[32m[dev]\x1b[0m ${message}`);
const warn = (message) => console.log(`\x1b[33m[dev]\x1b[0m ${message}`);
function fail(message) {
  console.error(`\x1b[31m[dev]\x1b[0m ${message}`);
  process.exit(1);
}

/** apps/api/.dev.vars with a random BETTER_AUTH_SECRET (also replaces the example's placeholder). */
function ensureApiVars() {
  if (!existsSync(API_VARS)) {
    copyFileSync(API_VARS_EXAMPLE, API_VARS);
    say('Created apps/api/.dev.vars');
  }
  const vars = readFileSync(API_VARS, 'utf8');
  if (/^BETTER_AUTH_SECRET=replace-me/m.test(vars)) {
    const secret = randomBytes(32).toString('base64');
    writeFileSync(API_VARS, vars.replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET=${secret}`));
    say('Generated BETTER_AUTH_SECRET in apps/api/.dev.vars');
  }
}

/** apps/mobile/.env; for the Android emulator the API URL must be 10.0.2.2, not localhost. */
function ensureAppEnv() {
  if (!existsSync(APP_ENV)) {
    const example = readFileSync(APP_ENV_EXAMPLE, 'utf8');
    const env =
      target === 'android' ? example.replace(/^EXPO_PUBLIC_API_URL=.*$/m, `EXPO_PUBLIC_API_URL=${ANDROID_API_URL}`) : example;
    writeFileSync(APP_ENV, env);
    say('Created apps/mobile/.env');
    return;
  }
  const url = /^EXPO_PUBLIC_API_URL=(.*)$/m.exec(readFileSync(APP_ENV, 'utf8'))?.[1]?.trim();
  if (target === 'android' && url?.includes('localhost')) {
    warn(`apps/mobile/.env points at ${url}; the Android emulator needs EXPO_PUBLIC_API_URL=${ANDROID_API_URL}`);
  }
}

/** Applies pending local D1 migrations (CI=1 answers wrangler's confirmation prompt). */
function migrate() {
  const result = spawnSync('pnpm', ['--filter', '@fitplan/api', 'db:migrate:local'], {
    cwd: ROOT,
    env: { ...process.env, CI: '1' },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    fail('Applying the local database migrations failed (output above).');
  }
  say('Local database is up to date');
}

/** Tells the user how to import the USDA foods when none are there yet. */
function checkFoods() {
  const result = spawnSync(
    'pnpm',
    ['--filter', '@fitplan/api', 'exec', 'wrangler', 'd1', 'execute', 'fitplan', '--local', '--json', '--command',
      "SELECT count(*) AS n FROM foods WHERE source = 'usda_sr_legacy'"],
    { cwd: ROOT, encoding: 'utf8' },
  );
  const count = /"n":\s*(\d+)/.exec(result.stdout ?? '')?.[1];
  if (count === '0') {
    warn('No USDA foods yet: search will only find custom foods. See "导入食物数据" in README.md.');
  }
}

async function waitForApi(api) {
  const started = Date.now();
  while (Date.now() - started < API_START_TIMEOUT_MS) {
    if (api.exitCode !== null) fail('The API stopped while starting (see the [api] lines above).');
    try {
      if ((await fetch(API_HEALTH)).ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  fail(`The API did not answer ${API_HEALTH} within ${API_START_TIMEOUT_MS / 1000} s.`);
}

/** Prefix each output line of the API with [api], so it stays apart from Expo's output. */
function prefixLines(stream, out) {
  let pending = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    const lines = (pending + chunk).split('\n');
    pending = lines.pop() ?? '';
    for (const line of lines) out.write(`\x1b[36m[api]\x1b[0m ${line}\n`);
  });
}

ensureApiVars();
ensureAppEnv();
migrate();
checkFoods();

say('Starting the API on http://localhost:8787 …');
// Not attached to the terminal: wrangler then skips its own key shortcuts, which would
// compete with Expo's for the keyboard.
const api = spawn('pnpm', ['--filter', '@fitplan/api', 'dev'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
prefixLines(api.stdout, process.stdout);
prefixLines(api.stderr, process.stderr);

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  if (api.exitCode === null) api.kill('SIGINT');
  process.exitCode = code;
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
api.on('exit', (code) => {
  if (!stopping) {
    warn(`The API stopped (exit code ${code}). Press Ctrl+C to quit.`);
  }
});

await waitForApi(api);
say(`API is ready. Starting the app${target === 'none' ? '' : ` (${target === 'ios' ? 'iOS simulator' : 'Android emulator'})`} …`);

const expoArgs = ['--filter', '@fitplan/mobile', 'start', ...(target === 'none' ? [] : ['--', `--${target}`])];
const app = spawn('pnpm', expoArgs, { cwd: ROOT, stdio: 'inherit' });
app.on('exit', (code) => stop(code ?? 0));
