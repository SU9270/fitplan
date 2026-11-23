import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '../i18n';
import { tokens } from '../theme/tokens';
import { Title } from './display';

type Props = {
  title: string;
  subtitle?: string;
  /** Sits on the back button's row, at the right edge (e.g. the "收藏" toggle). */
  right?: ReactNode;
  /** Sits between the back button's row and the title (e.g. a food's picture banner). */
  hero?: ReactNode;
};

/** Back button + title for screens pushed on top of the tabs. */
export function ScreenHeader({ title, subtitle, right, hero }: Props) {
  const { t } = useLocale();
  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('food.back')}
          hitSlop={tokens.space.sm}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <Ionicons name="chevron-back" size={tokens.fontSize.title} color={tokens.color.text} />
        </Pressable>
        {right}
      </View>
      {hero}
      {title !== '' ? (
        <View style={styles.texts}>
          <Title size="display">{title}</Title>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.space.lg,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.sm,
  },
  back: {
    width: tokens.touchTarget,
    height: tokens.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.touchTarget / 2,
    borderWidth: 1.5,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.card,
  },
  backPressed: {
    backgroundColor: tokens.color.surfaceRaised,
  },
  texts: {
    gap: tokens.space.xs,
  },
  subtitle: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.label,
  },
});
