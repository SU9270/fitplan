import { defineConfig } from 'drizzle-kit';

// Only generates SQL into ./migrations; wrangler applies them
// (`pnpm db:migrate:local` / `pnpm db:migrate:remote`).
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './migrations',
});
