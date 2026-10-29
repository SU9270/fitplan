import type { MessageKey, MessageParams } from '../i18n';

/** Better Auth's default `emailAndPassword.minPasswordLength` (the API keeps the default). */
export const PASSWORD_MIN_LENGTH = 8;

/** A translatable message: render with `t(message.key, message.params)`. */
export type FormMessage = { key: MessageKey; params?: MessageParams };

// Deliberately loose (something@something.tld): the server is the real validator; this only
// catches typos before a sign-up attempt spends an invite use.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const passwordTooShort: FormMessage = { key: 'auth.error.passwordTooShort', params: { min: PASSWORD_MIN_LENGTH } };

export function validateSignIn(form: { email: string; password: string }): FormMessage | null {
  if (!EMAIL_SHAPE.test(form.email.trim())) return { key: 'auth.error.emailInvalid' };
  if (form.password === '') return { key: 'auth.error.passwordRequired' };
  return null;
}

/**
 * Check the sign-up form on the device first: the API reserves an invite use before
 * Better Auth validates the rest, so a request that fails for a typo still costs one.
 */
export function validateSignUp(form: { email: string; password: string; inviteCode: string }): FormMessage | null {
  if (!EMAIL_SHAPE.test(form.email.trim())) return { key: 'auth.error.emailInvalid' };
  if (form.password.length < PASSWORD_MIN_LENGTH) return passwordTooShort;
  if (form.inviteCode.trim() === '') return { key: 'auth.error.inviteRequired' };
  return null;
}

/** Better Auth requires `name` on sign-up; the app has no name field, so use the email's local part. */
export function nameFromEmail(email: string): string {
  return email.trim().split('@')[0] ?? '';
}

const CODE_MESSAGES = new Map<string, MessageKey>([
  ['invite_required', 'auth.error.inviteRequired'],
  ['invite_exhausted', 'auth.error.inviteExhausted'],
  ['INVALID_EMAIL_OR_PASSWORD', 'auth.error.invalidCredentials'],
  ['INVALID_EMAIL', 'auth.error.emailInvalid'],
  ['USER_ALREADY_EXISTS', 'auth.error.emailTaken'],
  ['USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 'auth.error.emailTaken'],
]);

function stringField(value: object, field: 'code' | 'error'): string | undefined {
  const raw: unknown = (value as Record<string, unknown>)[field];
  return typeof raw === 'string' ? raw : undefined;
}

/**
 * Turn whatever a sign-in / sign-up attempt produced — a Better Auth `{ status, code }` error,
 * an API body with `code` or `error`, or a thrown fetch error — into a readable message.
 */
export function authErrorMessage(error: unknown): FormMessage {
  // React Native's fetch rejects with a TypeError ("Network request failed") when offline.
  if (error instanceof TypeError) return { key: 'auth.error.network' };
  if (typeof error !== 'object' || error === null) return { key: 'auth.error.unknown' };

  for (const field of ['code', 'error'] as const) {
    const code = stringField(error, field);
    if (code === 'PASSWORD_TOO_SHORT') return passwordTooShort;
    const key = code === undefined ? undefined : CODE_MESSAGES.get(code);
    if (key) return { key };
  }

  const status: unknown = (error as Record<string, unknown>).status;
  if (status === 429) return { key: 'auth.error.tooManyRequests' };
  if (status === 0) return { key: 'auth.error.network' };
  return { key: 'auth.error.unknown' };
}
