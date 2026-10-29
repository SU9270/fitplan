import { GAIN_SURPLUS, LOSS_WEEKLY_PCT, type Goal, type Pace } from '@fitplan/core';
import type { MessageKey } from '../i18n';

const PERCENT = 100;
const PERCENT_DECIMALS = 2;

const percent = (fraction: number): number => Number((fraction * PERCENT).toFixed(PERCENT_DECIMALS));

/** The one-line explanation of a pace, straight from core's constants (never retyped here). */
export function paceDescription(goal: Goal, pace: Pace): { key: MessageKey; params: { pct: number } } {
  return goal === 'lose'
    ? { key: 'onboarding.pace.lose.desc', params: { pct: percent(LOSS_WEEKLY_PCT[pace]) } }
    : { key: 'onboarding.pace.gain.desc', params: { pct: percent(GAIN_SURPLUS[pace] - 1) } };
}
