import { router } from 'expo-router';
import { useState } from 'react';
import { AuthHeader } from '../../components/auth-header';
import { ErrorText, PrimaryButton, TextButton, TextField } from '../../components/form';
import { Screen } from '../../components/screen';
import { useLocale } from '../../i18n';
import { authClient } from '../../lib/auth-client';
import { authErrorMessage, validateSignIn, type FormMessage } from '../../lib/auth-form';

export default function SignIn() {
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<FormMessage | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const invalid = validateSignIn({ email, password });
    setMessage(invalid);
    if (invalid) return;

    setBusy(true);
    try {
      const { error } = await authClient.signIn.email({ email: email.trim(), password });
      // On success the session updates and the root guard leaves (auth) on its own.
      if (error) setMessage(authErrorMessage(error));
    } catch (thrown) {
      setMessage(authErrorMessage(thrown));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen centered>
      <AuthHeader title={t('auth.signIn.title')} subtitle={t('auth.signIn.subtitle')} />
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
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      <ErrorText message={message && t(message.key, message.params)} />
      <PrimaryButton title={t('auth.signIn.submit')} busy={busy} onPress={() => void submit()} />
      <TextButton title={t('auth.signIn.toSignUp')} onPress={() => router.replace('/sign-up')} disabled={busy} />
    </Screen>
  );
}
