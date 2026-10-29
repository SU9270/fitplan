// `import type { AppType } from '@fitplan/api'` makes tsc follow the API's *source* files,
// which mention Cloudflare Workers globals. @cloudflare/workers-types can't be loaded here
// (it redefines fetch/Request/Response and clashes with React Native's DOM lib), so declare
// just the names the API source uses, opaquely. The app never touches these values.
// If the API starts using another Workers global, `pnpm typecheck` names it — add it here.
interface D1Database {}
