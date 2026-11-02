type Issue = { path: readonly PropertyKey[]; code: string };

/** The slice of a Zod schema used here (keeps zod itself out of this package's dependencies). */
export interface Parser<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: { issues: readonly Issue[] } };
}

export type Parsed<T> = { ok: true; data: T } | { ok: false; fields: Record<string, string> };

/** `{ 'healthFlags.medicalDiet': 'invalid_type' }`; the first issue per field wins. */
export function fieldErrors(issues: readonly Issue[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_root';
    fields[key] ??= issue.code;
  }
  return fields;
}

export function parseValue<T>(value: unknown, schema: Parser<T>): Parsed<T> {
  const parsed = schema.safeParse(value);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, fields: fieldErrors(parsed.error.issues) };
}

export async function parseBody<T>(req: Request, schema: Parser<T>): Promise<Parsed<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { ok: false, fields: { _root: 'invalid_json' } };
  }
  return parseValue(json, schema);
}
