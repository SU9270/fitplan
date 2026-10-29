import type { MacroTargets } from '@fitplan/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/card';
import { ErrorText, PrimaryButton, TextButton } from '../components/form';
import { MacroTiles } from '../components/macro-tiles';
import { Screen } from '../components/screen';
import { SegmentedControl } from '../components/segmented-control';
import { useLocale, type Locale } from '../i18n';
import { api } from '../lib/api';
import { authClient } from '../lib/auth-client';
import { useGate } from '../lib/gate';
import { useSignOut } from '../lib/use-sign-out';
import type { SavedProfile } from '../onboarding/draft-model';
import { useOnboarding } from '../onboarding/draft';
import { tokens } from '../theme/tokens';

type Targets =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; targets: MacroTargets; profile: SavedProfile | null };

const LOCALES = ['zh', 'en'] as const satisfies readonly Locale[];

/**
 * Today placeholder: the latest daily targets, and "Edit my answers", which re-opens the
 * questionnaire pre-filled from the saved profile. Everything else arrives in later phases.
 */
export default function Today() {
  const { t, locale, setLocale } = useLocale();
  const signOut = useSignOut();
  const { editing, startEditing, stopEditing } = useGate();
  const { ownerId, editFrom } = useOnboarding();
  const [targets, setTargets] = useState<Targets>({ state: 'loading' });
  const [openWizard, setOpenWizard] = useState(false);

  // Back on Today without saving (back button / swipe from the first step): close the questionnaire.
  useFocusEffect(stopEditing);

  // The guard opens (onboarding) only after `editing` has rendered, so navigate from here
  // rather than in the press handler (a push before that would be refused).
  useEffect(() => {
    if (!openWizard || !editing) return;
    setOpenWizard(false);
    router.push('/goal');
  }, [openWizard, editing]);

  function editAnswers(profile: SavedProfile) {
    if (ownerId === null) return;
    editFrom(profile, ownerId);
    startEditing();
    setOpenWizard(true);
  }

  const load = useCallback(async () => {
    setTargets({ state: 'loading' });
    try {
      const res = await api.api.me.profile.$get();
      if ((res.status as number) === 401) {
        await authClient.signOut();
        return;
      }
      if (!res.ok) throw new Error(`GET /api/me/profile → ${res.status}`);
      const { latestGoal, profile } = await res.json();
      setTargets(latestGoal ? { state: 'ready', targets: latestGoal.targets, profile } : { state: 'error' });
    } catch {
      setTargets({ state: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const savedProfile = targets.state === 'ready' ? targets.profile : null;

  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        {t('today.title')}
      </Text>

      <Card>
        <Text style={styles.cardTitle}>{t('today.target')}</Text>
        {targets.state === 'loading' ? (
          <ActivityIndicator color={tokens.color.primary} accessibilityLabel={t('gate.loading')} />
        ) : targets.state === 'error' ? (
          <>
            <ErrorText message={t('today.loadError')} />
            <PrimaryButton title={t('gate.error.retry')} onPress={() => void load()} />
          </>
        ) : (
          <>
            <Text style={styles.kcal}>{t('report.kcal', { n: targets.targets.kcal })}</Text>
            <MacroTiles targets={targets.targets} />
            {savedProfile ? (
              <TextButton title={t('today.editAnswers')} onPress={() => editAnswers(savedProfile)} />
            ) : null}
          </>
        )}
      </Card>

      <Text style={styles.comingSoon}>{t('today.comingSoon')}</Text>

      <View style={styles.group}>
        <Text style={styles.cardTitle}>{t('lang.label')}</Text>
        <SegmentedControl
          label={t('lang.label')}
          value={locale}
          options={LOCALES.map((l) => ({ value: l, label: t(`lang.${l}`) }))}
          onChange={setLocale}
        />
      </View>

      <TextButton title={t('auth.signOut')} onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.title,
    fontWeight: tokens.fontWeight.bold,
  },
  cardTitle: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.body,
    fontWeight: tokens.fontWeight.semibold,
  },
  kcal: {
    color: tokens.color.primary,
    fontSize: tokens.fontSize.display,
    fontWeight: tokens.fontWeight.bold,
  },
  comingSoon: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.body,
    textAlign: 'center',
  },
  group: {
    gap: tokens.space.sm,
  },
});
