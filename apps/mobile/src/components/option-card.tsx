import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';

type Props = {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
};

/** Large single-choice card (goal, activity level, experience). Used inside a radiogroup `View`. */
export function OptionCard({ title, description, selected, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={description ? `${title}. ${description}` : title}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.card, selected && styles.cardSelected]}
    >
      <View style={[styles.dot, selected && styles.dotSelected]}>{selected && <View style={styles.dotInner} />}</View>
      <View style={styles.texts}>
        <Text style={[styles.title, selected && styles.titleSelected]}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Groups `OptionCard`s for screen readers. */
export function OptionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.group}>
      {children}
    </View>
  );
}

const DOT = 22;

const styles = StyleSheet.create({
  group: {
    gap: tokens.space.sm,
  },
  card: {
    minHeight: tokens.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    padding: tokens.space.lg,
    borderRadius: tokens.radius.lg,
    borderWidth: 1.5,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
  },
  cardSelected: {
    borderColor: tokens.color.primary,
    backgroundColor: tokens.color.primarySoft,
  },
  dot: {
    width: DOT,
    height: DOT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.pill,
    borderWidth: 2,
    borderColor: tokens.color.border,
  },
  dotSelected: {
    borderColor: tokens.color.primary,
  },
  dotInner: {
    width: DOT / 2,
    height: DOT / 2,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.primary,
  },
  texts: {
    flex: 1,
    gap: tokens.space.xs,
  },
  title: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.subtitle,
    fontWeight: tokens.fontWeight.semibold,
  },
  titleSelected: {
    color: tokens.color.primary,
  },
  description: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
});
