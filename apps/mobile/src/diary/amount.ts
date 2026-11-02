import { MAX_ENTRY_GRAMS } from '@fitplan/validators';

/** A food's household measure, as the API returns it. */
export interface Portion {
  id: string;
  /** Null for a custom food's unnamed serving. */
  label: string | null;
  grams: number;
}

/** What the quantity counts: grams, or one of the food's portions. */
export type AmountUnit = { kind: 'grams' } | { kind: 'portion'; portion: Portion };

/**
 * A positive decimal typed by the user ("1.5", "1,5", ".5"), or null. Stricter than `Number()`,
 * which would also accept "0x10", "1e3" or "".
 */
export function parseDecimal(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(normalized)) return null;
  return Number(normalized);
}

export function gramsOf(unit: AmountUnit, quantity: number): number {
  return unit.kind === 'grams' ? quantity : unit.portion.grams * quantity;
}

export type AmountCheck =
  | { ok: true; grams: number; portionId: string | null; quantity: number }
  | { ok: false; error: 'invalid' | 'tooBig' };

/** The request body's amount (`portionId` + `quantity`) for what was typed, checked like the server does. */
export function checkAmount(unit: AmountUnit, quantityText: string): AmountCheck {
  const quantity = parseDecimal(quantityText);
  if (quantity === null || quantity <= 0) return { ok: false, error: 'invalid' };
  const grams = gramsOf(unit, quantity);
  if (grams > MAX_ENTRY_GRAMS) return { ok: false, error: 'tooBig' };
  return { ok: true, grams, portionId: unit.kind === 'portion' ? unit.portion.id : null, quantity };
}

/** Quantity shown in the input when a unit is picked: 100 g, or 1 portion. */
export function defaultQuantity(unit: AmountUnit): string {
  return unit.kind === 'grams' ? '100' : '1';
}

/** Numbers for display: whole numbers as-is, otherwise up to `decimals` places ("1.5", "0.33"). */
export function formatNumber(n: number, decimals = 1): string {
  const factor = 10 ** decimals;
  return String(Math.round(n * factor) / factor);
}

/**
 * Where the entry editor starts: the portion the entry was logged with, when the food still
 * has it; otherwise the entry's grams (the food or its portion may have been deleted).
 */
export function amountFromEntry(
  entry: { portionId: string | null; quantity: number; grams: number },
  portions: readonly Portion[],
): { unit: AmountUnit; quantity: string } {
  const portion = portions.find((p) => p.id === entry.portionId);
  return portion
    ? { unit: { kind: 'portion', portion }, quantity: formatNumber(entry.quantity, 2) }
    : { unit: { kind: 'grams' }, quantity: formatNumber(entry.grams, 2) };
}
