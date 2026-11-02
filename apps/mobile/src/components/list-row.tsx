import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';

type Props = {
  title: string;
  subtitle?: string;
  /** Right-aligned value, e.g. "248 千卡". */
  value?: string;
  /** Small pill after the title, e.g. "自定义". */
  badge?: string;
  onPress: () => void;
};

/** Tappable row inside a card or list: food search results and diary entries. */
export function ListRow({ title, subtitle, value, badge, onPress }: Props) {
  const label = [title, badge, subtitle, value].filter(Boolean).join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.texts}>
        <View style={styles.titleRow}>
          <Text numberOfLines={2} style={styles.title}>
            {title}
          </Text>
          {badge ? <Text style={styles.badge}>{badge}</Text> : null}
        </View>
        {subtitle ? (
          <Text numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: tokens.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingVertical: tokens.space.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  texts: {
    flex: 1,
    gap: tokens.space.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
  },
  title: {
    flexShrink: 1,
    color: tokens.color.text,
    fontSize: tokens.fontSize.body,
    fontWeight: tokens.fontWeight.medium,
  },
  badge: {
    paddingHorizontal: tokens.space.sm,
    paddingVertical: tokens.space.xs / 2,
    overflow: 'hidden',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.primarySoft,
    color: tokens.color.primary,
    fontSize: tokens.fontSize.caption,
  },
  subtitle: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
  value: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.body,
    fontWeight: tokens.fontWeight.semibold,
  },
});
