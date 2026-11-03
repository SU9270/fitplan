import { quickAddInputSchema, type Meal, type QuickAddInput } from '@fitplan/validators';
import type { Locale, MessageKey, t as translate } from '../i18n';
import { parseDecimal } from './amount';
import { displayName } from './display';

type T = typeof translate;

/** An entry's name: a quick add without a name reads "快速添加". */
export function entryName(item: { name: string; nameZh: string | null; quick?: boolean }, locale: Locale, t: T): string {
  if (item.quick && item.name.trim() === '') return t('quick.defaultName');
  return displayName(item, locale);
}

/** Up to this many food names go into a saved meal's default name. */
const DEFAULT_NAME_ITEMS = 3;
/** The server's limit for a saved meal's name. */
const TEMPLATE_NAME_MAX = 80;

/** "鸡胸肉（烤） + 白米饭 + 西兰花…": the first foods of the meal. */
export function defaultTemplateName(names: readonly string[], t: T): string {
  const shown = names.slice(0, DEFAULT_NAME_ITEMS).join(t('templates.separator'));
  const name = names.length > DEFAULT_NAME_ITEMS ? `${shown}…` : shown;
  return name.length > TEMPLATE_NAME_MAX ? `${name.slice(0, TEMPLATE_NAME_MAX - 1)}…` : name;
}

export interface QuickFormValues {
  name: string;
  kcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
}

export type QuickFormField = keyof QuickFormValues;

export const EMPTY_QUICK_FORM: QuickFormValues = { name: '', kcal: '', proteinG: '', carbsG: '', fatG: '' };

const MACROS = ['proteinG', 'carbsG', 'fatG'] as const;

/**
 * The quick-add form as a request body. Calories are required; an empty macro is unknown (null),
 * never 0. Ranges are the server's (`quickAddInputSchema`).
 */
export function toQuickAddInput(
  values: QuickFormValues,
  date: string,
  meal: Meal,
): { ok: true; input: QuickAddInput } | { ok: false; errors: Partial<Record<QuickFormField, MessageKey>> } {
  const errors: Partial<Record<QuickFormField, MessageKey>> = {};
  const macros: Record<(typeof MACROS)[number], number | null> = { proteinG: null, carbsG: null, fatG: null };
  for (const key of MACROS) {
    if (values[key].trim() === '') continue;
    const n = parseDecimal(values[key]);
    if (n === null) errors[key] = 'quick.error.number';
    else macros[key] = n;
  }
  const kcal = parseDecimal(values.kcal);
  const parsed = quickAddInputSchema.safeParse({ date, meal, name: values.name, kcal: kcal ?? Number.NaN, ...macros });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === 'kcal') errors.kcal = 'quick.error.kcal';
      else if (field === 'proteinG' || field === 'carbsG' || field === 'fatG') errors[field] ??= 'quick.error.number';
      else if (field === 'name') errors.name = 'quick.error.number';
    }
  }
  return Object.keys(errors).length > 0 || !parsed.success ? { ok: false, errors } : { ok: true, input: parsed.data };
}
