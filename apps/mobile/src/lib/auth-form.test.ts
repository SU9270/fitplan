import { authErrorMessage, nameFromEmail, PASSWORD_MIN_LENGTH, validateSignIn, validateSignUp } from './auth-form';

describe('validateSignUp', () => {
  const ok = { email: 'li@example.com', password: 'x'.repeat(PASSWORD_MIN_LENGTH), inviteCode: 'ABC123' };

  it('accepts a complete form', () => {
    expect(validateSignUp(ok)).toBeNull();
  });

  it('rejects a malformed email', () => {
    expect(validateSignUp({ ...ok, email: 'li@' })).toEqual({ key: 'auth.error.emailInvalid' });
    expect(validateSignUp({ ...ok, email: 'no-at-sign' })).toEqual({ key: 'auth.error.emailInvalid' });
  });

  it('rejects a short password', () => {
    expect(validateSignUp({ ...ok, password: 'x'.repeat(PASSWORD_MIN_LENGTH - 1) })).toEqual({
      key: 'auth.error.passwordTooShort',
      params: { min: PASSWORD_MIN_LENGTH },
    });
  });

  it('rejects a blank invite code', () => {
    expect(validateSignUp({ ...ok, inviteCode: '   ' })).toEqual({ key: 'auth.error.inviteRequired' });
  });
});

describe('validateSignIn', () => {
  it('needs an email shape and a password', () => {
    expect(validateSignIn({ email: 'li@example.com', password: 'p' })).toBeNull();
    expect(validateSignIn({ email: 'li', password: 'p' })).toEqual({ key: 'auth.error.emailInvalid' });
    expect(validateSignIn({ email: 'li@example.com', password: '' })).toEqual({ key: 'auth.error.passwordRequired' });
  });
});

describe('authErrorMessage', () => {
  it('maps the invite errors from the API', () => {
    expect(authErrorMessage({ status: 403, code: 'invite_required' })).toEqual({ key: 'auth.error.inviteRequired' });
    expect(authErrorMessage({ status: 403, code: 'invite_exhausted' })).toEqual({ key: 'auth.error.inviteExhausted' });
  });

  it('maps Better Auth codes', () => {
    expect(authErrorMessage({ status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' })).toEqual({
      key: 'auth.error.invalidCredentials',
    });
    expect(authErrorMessage({ status: 422, code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' })).toEqual({
      key: 'auth.error.emailTaken',
    });
    expect(authErrorMessage({ status: 400, code: 'PASSWORD_TOO_SHORT' })).toEqual({
      key: 'auth.error.passwordTooShort',
      params: { min: PASSWORD_MIN_LENGTH },
    });
  });

  it('reads the `error` key too', () => {
    expect(authErrorMessage({ status: 403, error: 'invite_exhausted' })).toEqual({ key: 'auth.error.inviteExhausted' });
  });

  it('maps rate limiting, network failures and anything else', () => {
    expect(authErrorMessage({ status: 429 })).toEqual({ key: 'auth.error.tooManyRequests' });
    expect(authErrorMessage(new TypeError('Network request failed'))).toEqual({ key: 'auth.error.network' });
    expect(authErrorMessage({ status: 0 })).toEqual({ key: 'auth.error.network' });
    expect(authErrorMessage({ status: 500, code: 'internal_error' })).toEqual({ key: 'auth.error.unknown' });
    expect(authErrorMessage(undefined)).toEqual({ key: 'auth.error.unknown' });
  });
});

describe('nameFromEmail', () => {
  it('uses the local part of the address', () => {
    expect(nameFromEmail('  Li.Hua@example.com ')).toBe('Li.Hua');
  });
});
