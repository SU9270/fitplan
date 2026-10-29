// Mint an invite code and insert it into the D1 database.
//
//   pnpm --filter @fitplan/api invite:create -- --uses 5            # local (wrangler dev) database
//   pnpm --filter @fitplan/api invite:create -- --uses 5 --remote   # deployed database
//
// The local database must have migrations applied first (`pnpm db:migrate:local`).
import { spawnSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { parseArgs } from 'node:util';

// No 0/O/1/I/L so codes can be read aloud and typed on a phone without mistakes.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 10;
const DATABASE_NAME = 'fitplan';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

// pnpm forwards the `--` separator; drop it so the flags after it are parsed.
const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    uses: { type: 'string', default: '1' },
    remote: { type: 'boolean', default: false },
  },
});

const uses = Number(values.uses);
if (!Number.isInteger(uses) || uses < 1) {
  fail(`--uses must be a positive integer, got "${values.uses}"`);
}

const code = generateCode();
// Both values are generated/validated above (fixed alphabet, integer), so inlining them is safe.
const sql = `INSERT INTO invite_codes (code, max_uses) VALUES ('${code}', ${uses});`;

const result = spawnSync(
  'pnpm',
  ['exec', 'wrangler', 'd1', 'execute', DATABASE_NAME, values.remote ? '--remote' : '--local', '--command', sql],
  { cwd: new URL('..', import.meta.url), stdio: ['ignore', 'ignore', 'inherit'] },
);
if (result.status !== 0) {
  fail('wrangler d1 execute failed; see the output above.');
}

console.log(`Invite code (${uses} use${uses === 1 ? '' : 's'}, ${values.remote ? 'remote' : 'local'}): ${code}`);
