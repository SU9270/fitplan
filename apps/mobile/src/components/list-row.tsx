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

/** Tappable white tile inside a card: food search results, diary entries, custom foods. */
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
    paddingHorizontal: tokens.card.tilePaddingX,
    paddingVertical: tokens.card.tilePaddingY,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
  },
  pressed: {
    backgroundColor: tokens.color.border,
  },
  texts: {
    flex: 1,
    gap: tokens.hairline,
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
    paddingVertical: tokens.hairline,
    overflow: 'hidden',
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.primarySoft,
    color: tokens.color.primary,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.medium,
  },
  subtitle: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
  value: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.semibold,
  },
});
