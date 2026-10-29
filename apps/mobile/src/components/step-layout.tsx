import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocale } from '../i18n';
import type { Preview } from '../onboarding/preview';
import { tokens } from '../theme/tokens';
import { PrimaryButton, TextButton } from './form';
import { LanguageSwitch } from './language-switch';
import { PreviewStrip } from './preview-strip';
import { Screen } from './screen';
import { StepProgress } from './step-progress';

export const ONBOARDING_STEPS = 4;

type Props = {
  step: number;
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Local estimate shown above the buttons; `null` hides it. */
  preview: Preview | null;
  onBack?: () => void;
  onNext: () => void;
  nextTitle?: string;
  nextBusy?: boolean;
  /** Extra content under the buttons (e.g. sign out on the first step). */
  footer?: ReactNode;
};

/** Shared frame of the four questionnaire steps: progress, title, content, preview, navigation. */
export function StepLayout({
  step,
  title,
  subtitle,
  children,
  preview,
  onBack,
  onNext,
  nextTitle,
  nextBusy,
  footer,
}: Props) {
  const { t } = useLocale();
  return (
    <Screen>
      <View style={styles.topRow}>
        <View style={styles.progress}>
          <StepProgress step={step} total={ONBOARDING_STEPS} />
        </View>
        <LanguageSwitch />
      </View>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {children}
      <PreviewStrip preview={preview} />
      <Text style={styles.disclaimer}>{t('onboarding.disclaimer')}</Text>
      <View style={styles.nav}>
        <PrimaryButton title={nextTitle ?? t('onboarding.next')} onPress={onNext} busy={nextBusy} />
        {onBack ? <TextButton title={t('onboarding.back')} onPress={onBack} disabled={nextBusy} /> : null}
        {footer}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
  },
  progress: {
    flex: 1,
  },
  heading: {
    gap: tokens.space.sm,
  },
  title: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.title,
    fontWeight: tokens.fontWeight.bold,
  },
  subtitle: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.body,
  },
  disclaimer: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
    textAlign: 'center',
  },
  nav: {
    gap: tokens.space.sm,
  },
});
