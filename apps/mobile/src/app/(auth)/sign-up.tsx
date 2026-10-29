import { router } from 'expo-router';
import { useState } from 'react';
import { AuthHeader } from '../../components/auth-header';
import { ErrorText, PrimaryButton, TextButton, TextField } from '../../components/form';
import { Screen } from '../../components/screen';
import { useLocale } from '../../i18n';
import { authClient } from '../../lib/auth-client';
import {
  authErrorMessage,
  nameFromEmail,
  PASSWORD_MIN_LENGTH,
  validateSignUp,
  type FormMessage,
} from '../../lib/auth-form';

export default function SignUp() {
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [message, setMessage] = useState<FormMessage | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    // Validate locally first: a rejected sign-up still uses up one invite.
    const invalid = validateSignUp({ email, password, inviteCode });
    setMessage(invalid);
    if (invalid) return;

    setBusy(true);
    try {
      const trimmedEmail = email.trim();
      const { error } = await authClient.signUp.email({
        email: trimmedEmail,
        password,
        name: nameFromEmail(trimmedEmail),
        // The API's sign-up hook reads `inviteCode` from the request body.
        fetchOptions: { body: { inviteCode: inviteCode.trim() } },
      });
      // On success Better Auth signs the user in; the root guard moves on to onboarding.
      if (error) setMessage(authErrorMessage(error));
    } catch (thrown) {
      setMessage(authErrorMessage(thrown));
    } finally {
      setBusy(false);
    }
  }

  const passwordRule = t('auth.password.placeholder', { min: PASSWORD_MIN_LENGTH });

  return (
    <Screen centered>
      <AuthHeader title={t('auth.signUp.title')} subtitle={t('auth.signUp.subtitle')} />
      <TextField
        label={t('auth.email.label')}
        placeholder={t('auth.email.placeholder')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <TextField
        label={t('auth.password.label')}
        placeholder={passwordRule}
        hint={passwordRule}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
      />
      <TextField
        label={t('auth.inviteCode.label')}
        placeholder={t('auth.inviteCode.placeholder')}
        value={inviteCode}
        onChangeText={setInviteCode}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      <ErrorText message={message && t(message.key, message.params)} />
      <PrimaryButton title={t('auth.signUp.submit')} busy={busy} onPress={() => void submit()} />
      <TextButton title={t('auth.signUp.toSignIn')} onPress={() => router.replace('/sign-in')} disabled={busy} />
    </Screen>
  );
}
