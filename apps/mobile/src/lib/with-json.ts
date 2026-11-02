/**
 * Request args for a route with a path param that also takes a JSON body. The API parses
 * bodies itself (not with a Hono validator), so the RPC types only know about `param`; the
 * client still sends `json` as the body.
 */
export function withJson<P extends Record<string, string>>(param: P, json: unknown): { param: P } {
  return { param, json } as { param: P };
}
