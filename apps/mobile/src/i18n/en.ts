import type { MessageKey } from './zh';

/** English copy. Must have exactly the keys of `zh.ts` (checked by the compiler and by i18n.test.ts). */
export const en: Record<MessageKey, string> = {
  'app.name': 'FitPlan',

  'lang.switch': '中文',
  'lang.switchLabel': 'Switch to Chinese',

  'auth.email.label': 'Email',
  'auth.email.placeholder': 'you@example.com',
  'auth.password.label': 'Password',
  'auth.password.placeholder': 'At least {min} characters',
  'auth.inviteCode.label': 'Invite code',
  'auth.inviteCode.placeholder': 'Ask a friend for an invite code',

  'auth.signIn.title': 'Welcome back',
  'auth.signIn.subtitle': 'Sign in to continue your fitness and diet plan',
  'auth.signIn.submit': 'Sign in',
  'auth.signIn.toSignUp': 'No account yet? Sign up with an invite',

  'auth.signUp.title': 'Create your account',
  'auth.signUp.subtitle': 'FitPlan is invite-only for now',
  'auth.signUp.submit': 'Sign up',
  'auth.signUp.toSignIn': 'Already have an account? Sign in',

  'auth.signOut': 'Sign out',

  'auth.error.emailInvalid': 'Please enter a valid email address',
  'auth.error.passwordRequired': 'Please enter your password',
  'auth.error.passwordTooShort': 'Password must be at least {min} characters',
  'auth.error.inviteRequired': 'An invite code is required to sign up',
  'auth.error.inviteExhausted': 'This invite code is invalid or used up. Try another one',
  'auth.error.invalidCredentials': 'Incorrect email or password',
  'auth.error.emailTaken': 'This email is already registered. Please sign in',
  'auth.error.tooManyRequests': 'Too many attempts. Please try again later',
  'auth.error.network': "Can't reach the server. Check your connection and try again",
  'auth.error.unknown': 'Something went wrong. Please try again later',

  'gate.loading': 'Loading…',
  'gate.error.title': "We couldn't load your profile",
  'gate.error.retry': 'Retry',

  'onboarding.goal.title': 'Set your goal',
  'today.title': 'Today',

  'report.kcal': '{n} kcal',
};
