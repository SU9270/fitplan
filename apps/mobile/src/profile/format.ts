import { cmToFtIn, kgToLb } from '@fitplan/core';
import { nicknameSchema } from '@fitplan/validators';

export type UnitSystem = 'metric' | 'imperial';

/** "175 cm" or 5′9″ (rounded to the inch; 182.88 cm reads 6′0″, never 5′12″). */
export function formatHeight(cm: number, unit: UnitSystem): string {
  if (unit === 'metric') return `${Math.round(cm)} cm`;
  const { ft, in: inch } = cmToFtIn(cm);
  return `${ft}′${inch}″`;
}

/** "70.5 kg" or "155 lb" (one decimal for kg, whole pounds). */
export function formatWeight(kg: number, unit: UnitSystem): string {
  return unit === 'metric' ? `${Math.round(kg * 10) / 10} kg` : `${Math.round(kgToLb(kg))} lb`;
}

/** The avatar letter: the first character of the name (a whole emoji or CJK character), upper-cased. */
export function initial(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toUpperCase() : '?';
}

/** The trimmed nickname, or null when it breaks the server's rule (1–40 characters). */
export function checkNickname(text: string): string | null {
  const parsed = nicknameSchema.safeParse(text);
  return parsed.success ? parsed.data : null;
}
