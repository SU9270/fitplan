import { NUTRIENT_BASIS_G } from '@fitplan/core';
import { customFoodInputSchema, type CustomFoodInput } from '@fitplan/validators';
import type { MessageKey } from '../i18n';
import { formatNumber, parseDecimal } from './amount';

/** The custom food form as typed (every field is text). */
export interface CustomFormValues {
  name: string;
  servingLabel: string;
  servingGrams: string;
  kcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
}

export type CustomFormField = keyof CustomFormValues;

export const EMPTY_CUSTOM_FORM: CustomFormValues = {
  name: '',
  servingLabel: '',
  servingGrams: '',
  kcal: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
};

const NUMBER_FIELDS = ['servingGrams', 'kcal', 'proteinG', 'carbsG', 'fatG'] as const;

export type CustomFormResult =
  | { ok: true; input: CustomFoodInput }
  | { ok: false; errors: Partial<Record<CustomFormField, MessageKey>> };

/** Parses and checks the form with the same rules as the server (`customFoodInputSchema`). */
export function toCustomFoodInput(values: CustomFormValues): CustomFormResult {
  const numbers = Object.fromEntries(NUMBER_FIELDS.map((f) => [f, parseDecimal(values[f]) ?? Number.NaN]));
  const parsed = customFoodInputSchema.safeParse({
    name: values.name,
    servingLabel: values.servingLabel.trim() === '' ? null : values.servingLabel,
    ...numbers,
  });
  if (parsed.success) return { ok: true, input: parsed.data };

  const errors: Partial<Record<CustomFormField, MessageKey>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as CustomFormField | undefined;
    if (!field || errors[field]) continue;
    errors[field] =
      field === 'name'
        ? 'custom.error.name'
        : issue.message === 'macros_exceed_serving'
          ? 'custom.error.macros'
          : field === 'servingLabel'
            ? 'custom.error.servingLabel'
            : 'custom.error.number';
  }
  return { ok: false, errors };
}

/** Pre-fills the edit form: per-100 g values back to the serving the user entered. */
export function formFromFood(food: {
  name: string;
  per100g: { kcal: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null };
  portions: readonly { label: string | null; grams: number }[];
}): CustomFormValues {
  const serving = food.portions[0];
  const grams = serving?.grams ?? NUTRIENT_BASIS_G;
  const perServing = (v: number | null) => (v === null ? '' : formatNumber((v * grams) / NUTRIENT_BASIS_G));
  return {
    name: food.name,
    servingLabel: serving?.label ?? '',
    servingGrams: formatNumber(grams),
    kcal: perServing(food.per100g.kcal),
    proteinG: perServing(food.per100g.proteinG),
    carbsG: perServing(food.per100g.carbsG),
    fatG: perServing(food.per100g.fatG),
  };
}
