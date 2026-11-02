import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '../i18n';
import { tokens } from '../theme/tokens';

/** Back button + title for screens pushed on top of Today. */
export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { t } = useLocale();
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('food.back')}
        hitSlop={tokens.space.sm}
        onPress={() => router.back()}
        style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
      >
        <Ionicons name="chevron-back" size={tokens.fontSize.title} color={tokens.color.text} />
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.space.xs,
  },
  back: {
    width: tokens.touchTarget,
    height: tokens.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginBottom: tokens.space.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
  },
  backPressed: {
    backgroundColor: tokens.color.card,
  },
  title: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.title,
    fontWeight: tokens.fontWeight.semibold,
  },
  subtitle: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.body,
  },
});
