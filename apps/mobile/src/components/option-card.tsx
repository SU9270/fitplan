import Ionicons from '@expo/vector-icons/Ionicons';
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
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {/* The mark sits at the right edge, so every title starts on the card's inset. */}
      <View style={[styles.dot, selected && styles.dotSelected]}>
        {selected ? <Ionicons name="checkmark" size={DOT - tokens.space.sm} color={tokens.color.onPrimary} /> : null}
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

const DOT = 24;

const styles = StyleSheet.create({
  group: {
    gap: tokens.space.sm,
  },
  card: {
    minHeight: tokens.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingHorizontal: tokens.card.padding + tokens.card.headerInset,
    paddingVertical: tokens.space.lg,
    borderRadius: tokens.radius.lg,
    borderWidth: 1.5,
    borderColor: tokens.color.cardBorder,
    backgroundColor: tokens.color.card,
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
    borderWidth: 1.5,
    borderColor: tokens.color.borderStrong,
  },
  dotSelected: {
    borderColor: tokens.color.primary,
    backgroundColor: tokens.color.primary,
  },
  texts: {
    flex: 1,
    gap: tokens.space.xs,
  },
  title: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.body + 1,
    fontWeight: tokens.fontWeight.bold,
  },
  description: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
    lineHeight: tokens.fontSize.caption * 1.45,
  },
});
