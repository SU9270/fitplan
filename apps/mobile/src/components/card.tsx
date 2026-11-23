import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { tokens } from '../theme/tokens';
import { Kicker, Title, type } from './display';

/**
 * Card shell: a dark rounded block, one step lighter than the page, with a hairline edge.
 * Content goes in `Tile`s inside it (a step lighter again); a `CardHeader` labels the card.
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
  /** A leaning title when it is the card's name (a meal, a section) rather than a caption. */
  strong?: boolean;
  /** Small English label after a `strong` label ("BREAKFAST"); see `kicker` in i18n. */
  kicker?: string | null;
  /** Color square before the label, tying the card to a chart color (e.g. the kcal ring). */
  swatch?: string;
};

/** Card heading: gray label, optional large value with a unit, optional right-side content. */
export function CardHeader({ label, title, unit, right, strong = false, kicker, swatch }: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTexts}>
        <View style={styles.labelRow}>
          {swatch ? <View style={[styles.swatch, { backgroundColor: swatch }]} /> : null}
          {strong ? (
            <Title size="subtitle" numberOfLines={1}>
              {label}
            </Title>
          ) : (
            <Text accessibilityRole="header" style={styles.label}>
              {label}
            </Text>
          )}
          {strong ? <Kicker color={tokens.color.textTertiary}>{kicker ?? null}</Kicker> : null}
        </View>
        {title !== undefined ? (
          <Text style={[type.num, styles.title]}>
            {title}
            {unit ? <Text style={styles.unit}> {unit}</Text> : null}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/** Rounded block inside a card: a row, a stat, a form field group. */
export function Tile({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.tile, style]}>{children}</View>;
}

/** Same size as the squares in `MacroTiles`. */
const SWATCH = 10;

const styles = StyleSheet.create({
  card: {
    gap: tokens.card.gap,
    padding: tokens.card.padding,
    borderRadius: tokens.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.cardBorder,
    backgroundColor: tokens.color.card,
  },
  warning: {
    borderWidth: 1.5,
    borderColor: tokens.color.warning,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.sm,
    paddingHorizontal: tokens.card.headerInset,
    paddingTop: tokens.space.sm,
    paddingBottom: tokens.space.xs,
  },
  headerTexts: {
    flex: 1,
    gap: tokens.hairline,
  },
  label: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.semibold,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: tokens.hairline,
  },
  title: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.display,
  },
  unit: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.medium,
  },
  tile: {
    gap: tokens.space.xs,
    paddingHorizontal: tokens.card.tilePaddingX,
    paddingVertical: tokens.card.tilePaddingY,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
  },
});
