import type { GuardrailReason } from '@fitplan/core';
import type { MessageKey } from '../i18n';

/** Translated, plain-language copy for each guardrail reason code. Exhaustive by type. */
export const reasonMessageKey: Record<GuardrailReason, MessageKey> = {
  under_age: 'reason.under_age',
  bmi_too_low_for_loss: 'reason.bmi_too_low_for_loss',
  aggressive_pace: 'reason.aggressive_pace',
  high_bmi_consult: 'reason.high_bmi_consult',
  raised_to_floor: 'reason.raised_to_floor',
  safe_mode: 'reason.safe_mode',
};
