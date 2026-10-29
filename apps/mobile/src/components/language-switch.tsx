import { useLocale } from '../i18n';
import { TextButton } from './form';

/** Toggles zh ⇄ en. The label is written in the language you switch *to*. */
export function LanguageSwitch() {
  const { locale, setLocale, t } = useLocale();
  return (
    <TextButton
      title={t('lang.switch')}
      accessibilityLabel={t('lang.switchLabel')}
      onPress={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
    />
  );
}
