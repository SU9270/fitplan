import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { tokens } from '../theme/tokens';

/**
 * BoardUI card shell: a light-gray rounded block on the white page. Content goes in white
 * `Tile`s inside it; a `CardHeader` labels the card.
 */
export function Card({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'warning' }) {
  return <View style={[styles.card, tone === 'warning' && styles.warning]}>{children}</View>;
}

type HeaderProps = {
  /** Small gray label, e.g. "已吃", "午餐". */
  label: string;
  /** Optional large line under the label (a number, a status). */
  title?: string;
  /** Small gray text after `title`, e.g. "/ 2056 千卡". */
  unit?: string;
  /** Right-aligned extra (a subtotal, a button). */
  right?: ReactNode;
  /** Dark, larger label when it is the card's title (a meal, a section) rather than a caption. */
  strong?: boolean;
};

/** Card heading: gray label, optional large value with a unit, optional right-side content. */
export function CardHeader({ label, title, unit, right, strong = false }: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTexts}>
        <Text accessibilityRole="header" style={[styles.label, strong && styles.strong]}>
          {label}
        </Text>
        {title !== undefined ? (
          <Text style={styles.title}>
            {title}
            {unit ? <Text style={styles.unit}> {unit}</Text> : null}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/** White rounded block inside a card: a row, a stat, a form field group. */
export function Tile({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.tile, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    gap: tokens.card.gap,
    padding: tokens.card.padding,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.card,
  },
  warning: {
    borderWidth: 1.5,
    borderColor: tokens.color.warning,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tokens.space.sm,
    paddingHorizontal: tokens.card.headerInset,
    paddingTop: tokens.card.headerInset,
    paddingBottom: tokens.space.xs,
  },
  headerTexts: {
    flex: 1,
    gap: tokens.hairline,
  },
  label: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.medium,
  },
  strong: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.subtitle,
    fontWeight: tokens.fontWeight.semibold,
  },
  title: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.display,
    fontWeight: tokens.fontWeight.medium,
    letterSpacing: -0.5,
  },
  unit: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.medium,
    letterSpacing: 0,
  },
  tile: {
    gap: tokens.space.xs,
    paddingHorizontal: tokens.card.tilePaddingX,
    paddingVertical: tokens.card.tilePaddingY,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
  },
});
