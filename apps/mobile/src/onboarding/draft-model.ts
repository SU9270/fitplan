import type { ActivityLevel, Goal, HealthFlags, Pace, Sex } from '@fitplan/core';
import { cmToFtIn, ftInToCm, kgToLb, lbToKg } from '@fitplan/core';

export type UnitSystem = 'metric' | 'imperial';
export type TrainingExperience = 'beginner' | 'intermediate' | 'advanced';

/** A height as typed. Only the fields of `source` are authoritative; the other unit's fields are a display-only conversion. */
export interface HeightEntry {
  source: UnitSystem;
  cm: string;
  ft: string;
  in: string;
}

/** A weight as typed. Same rule as `HeightEntry`. */
export interface WeightEntry {
  source: UnitSystem;
  kg: string;
  lb: string;
}

/**
 * The questionnaire exactly as the user filled it in: numbers stay as text, and height and
 * weight stay in the unit they were typed in. Conversion to metric happens once, in
 * `toProfileInput`, so flipping the unit switch never drifts a value.
 */
export interface OnboardingDraft {
  goal: Goal;
  pace: Pace;
  age: string;
  sex: Sex | null;
  /** Which unit the basics step currently shows (also saved as the user's preference). */
  unitSystem: UnitSystem;
  height: HeightEntry;
  weight: WeightEntry;
  activityLevel: ActivityLevel | null;
  trainingDaysPerWeek: number | null;
  trainingExperience: TrainingExperience | null;
  healthFlags: HealthFlags;
  /** Health-data consent checkbox. */
  consent: boolean;
}

export function emptyDraft(): OnboardingDraft {
  return {
    goal: 'lose',
    pace: 'standard',
    age: '',
    sex: null,
    unitSystem: 'metric',
    height: { source: 'metric', cm: '', ft: '', in: '' },
    weight: { source: 'metric', kg: '', lb: '' },
    activityLevel: null,
    trainingDaysPerWeek: null,
    trainingExperience: null,
    healthFlags: { pregnantOrNursing: false, eatingDisorderHistory: false, medicalDiet: false },
    consent: false,
  };
}

/** Parse a typed number; blank or malformed text becomes NaN. Accepts a decimal comma. */
export function parseNumber(text: string): number {
  const normalized = text.trim().replace(',', '.');
  return normalized === '' ? Number.NaN : Number(normalized);
}

/** Height in cm from what was typed, or NaN when incomplete. */
export function heightCmOf(height: HeightEntry): number {
  if (height.source === 'metric') return parseNumber(height.cm);
  // Feet are required; a blank inches field means "exactly N feet".
  const ft = parseNumber(height.ft);
  const inch = height.in.trim() === '' ? 0 : parseNumber(height.in);
  return ftInToCm(ft, inch);
}

/** Weight in kg from what was typed, or NaN when incomplete. */
export function weightKgOf(weight: WeightEntry): number {
  return weight.source === 'metric' ? parseNumber(weight.kg) : lbToKg(parseNumber(weight.lb));
}

const DISPLAY_DECIMALS = 1;

function display(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toFixed(DISPLAY_DECIMALS))) : '';
}

/**
 * Show the other unit. Values typed in `to` stay exactly as typed; values typed in the other
 * unit get a freshly converted display copy (the typed ones are never overwritten).
 */
export function switchUnitSystem(draft: OnboardingDraft, to: UnitSystem): OnboardingDraft {
  return { ...draft, unitSystem: to, height: heightFor(draft.height, to), weight: weightFor(draft.weight, to) };
}

function heightFor(height: HeightEntry, to: UnitSystem): HeightEntry {
  if (height.source === to) return height;
  const cm = heightCmOf(height);
  // An incomplete height has no meaningful conversion: leave the other unit blank.
  if (!Number.isFinite(cm)) return to === 'imperial' ? { ...height, ft: '', in: '' } : { ...height, cm: '' };
  if (to === 'metric') return { ...height, cm: display(cm) };
  const { ft, in: inch } = cmToFtIn(cm);
  return { ...height, ft: String(ft), in: String(inch) };
}

function weightFor(weight: WeightEntry, to: UnitSystem): WeightEntry {
  if (weight.source === to) return weight;
  const kg = weightKgOf(weight);
  if (!Number.isFinite(kg)) return to === 'imperial' ? { ...weight, lb: '' } : { ...weight, kg: '' };
  return to === 'metric' ? { ...weight, kg: display(kg) } : { ...weight, lb: display(kgToLb(kg)) };
}

/** Editing a field in the shown unit makes that unit the source of truth for the measurement. */
export function setHeightField(draft: OnboardingDraft, field: 'cm' | 'ft' | 'in', value: string): OnboardingDraft {
  const source: UnitSystem = field === 'cm' ? 'metric' : 'imperial';
  return { ...draft, height: { ...draft.height, source, [field]: value } };
}

export function setWeightField(draft: OnboardingDraft, field: 'kg' | 'lb', value: string): OnboardingDraft {
  const source: UnitSystem = field === 'kg' ? 'metric' : 'imperial';
  return { ...draft, weight: { ...draft.weight, source, [field]: value } };
}

/** A saved profile as `GET /api/me/profile` returns it (the same fields as the questionnaire, already metric). */
export interface SavedProfile {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  trainingDaysPerWeek: number;
  trainingExperience: TrainingExperience;
  goal: Goal;
  pace: Pace;
  healthFlags: HealthFlags;
  unitSystem: UnitSystem;
}

/**
 * Re-open the questionnaire from a saved profile (one whose goal was never accepted, e.g. after
 * a 409 or 422). The user's unit preference decides which unit the values are "typed" in. A saved
 * profile implies the health-data consent was already recorded.
 */
export function draftFromProfile(p: SavedProfile): OnboardingDraft {
  const imperial = p.unitSystem === 'imperial';
  const { ft, in: inch } = cmToFtIn(p.heightCm);
  return {
    goal: p.goal,
    pace: p.pace,
    age: String(p.age),
    sex: p.sex,
    unitSystem: p.unitSystem,
    height: imperial
      ? { source: 'imperial', cm: '', ft: String(ft), in: String(inch) }
      : { source: 'metric', cm: display(p.heightCm), ft: '', in: '' },
    weight: imperial
      ? { source: 'imperial', kg: '', lb: display(kgToLb(p.weightKg)) }
      : { source: 'metric', kg: display(p.weightKg), lb: '' },
    activityLevel: p.activityLevel,
    trainingDaysPerWeek: p.trainingDaysPerWeek,
    trainingExperience: p.trainingExperience,
    healthFlags: { ...p.healthFlags },
    consent: true,
  };
}
