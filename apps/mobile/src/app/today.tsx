import type { MacroTargets } from '@fitplan/core';
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
import { useSignOut } from '../lib/use-sign-out';
import { tokens } from '../theme/tokens';

type Targets = { state: 'loading' } | { state: 'error' } | { state: 'ready'; targets: MacroTargets };

const LOCALES = ['zh', 'en'] as const satisfies readonly Locale[];

/** Today placeholder: the latest daily targets; everything else arrives in later phases. */
export default function Today() {
  const { t, locale, setLocale } = useLocale();
  const signOut = useSignOut();
  const [targets, setTargets] = useState<Targets>({ state: 'loading' });

  const load = useCallback(async () => {
    setTargets({ state: 'loading' });
    try {
      const res = await api.api.me.profile.$get();
      if ((res.status as number) === 401) {
        await authClient.signOut();
        return;
      }
      if (!res.ok) throw new Error(`GET /api/me/profile → ${res.status}`);
      const { latestGoal } = await res.json();
      setTargets(latestGoal ? { state: 'ready', targets: latestGoal.targets } : { state: 'error' });
    } catch {
      setTargets({ state: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

      <TextButton title={t('auth.signOut')} onPress={signOut} />
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
