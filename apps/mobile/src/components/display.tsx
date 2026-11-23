import { StyleSheet, Text, type TextStyle } from 'react-native';
import { tokens } from '../theme/tokens';

/** Printable ASCII only: such a title is set in Fugaz One; anything else in the system font. */
const LATIN = /^[\x20-\x7E]*$/;

type TitleSize = 'hero' | 'display' | 'title' | 'subtitle';

type TitleProps = {
  children: string;
  /** hero: a tab's page title; display: a pushed screen's or a step's; title / subtitle: a card's. */
  size?: TitleSize;
  /** Defaults to the primary text color; pass the ticket or banner ink when on one. */
  color?: string;
  numberOfLines?: number;
};

/**
 * A heavy title that leans to the right, the theme's signature. English is set in Fugaz One
 * (drawn leaning) in capitals; Chinese has no such font on the phone, so the system font at its
 * heaviest is skewed by the same angle.
 */
export function Title({ children, size = 'hero', color, numberOfLines = 2 }: TitleProps) {
  const latin = LATIN.test(children);
  return (
    <Text
      accessibilityRole="header"
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      style={[styles.title, SIZES[size], latin ? styles.latin : styles.leaning, color ? { color } : null]}
    >
      {children}
    </Text>
  );
}

type KickerProps = { children: string | null; color?: string };

/** The small English label in capitals above or beside a title ("FOOD LIBRARY"); renders nothing for null. */
export function Kicker({ children, color }: KickerProps) {
  if (!children) return null;
  return <Text style={[styles.kicker, color ? { color } : null]}>{children}</Text>;
}

/** Line heights: tight for large titles (they are one or two short lines), looser as they get smaller. */
const SIZES: Record<TitleSize, TextStyle> = {
  hero: { fontSize: tokens.fontSize.hero, lineHeight: tokens.fontSize.hero * 1.15 },
  display: { fontSize: tokens.fontSize.display, lineHeight: tokens.fontSize.display * 1.2 },
  title: { fontSize: tokens.fontSize.title, lineHeight: tokens.fontSize.title * 1.25 },
  subtitle: { fontSize: tokens.fontSize.subtitle + 2, lineHeight: (tokens.fontSize.subtitle + 2) * 1.3 },
};

const styles = StyleSheet.create({
  title: {
    alignSelf: 'flex-start',
    flexShrink: 1,
    color: tokens.color.text,
  },
  latin: {
    fontFamily: tokens.font.display,
    textTransform: 'uppercase',
  },
  leaning: {
    fontWeight: tokens.fontWeight.heavy,
    transform: [{ skewX: tokens.titleSkew }],
  },
  kicker: {
    color: tokens.color.primary,
    fontFamily: tokens.font.display,
    fontSize: tokens.fontSize.micro + 1,
    letterSpacing: 1,
  },
});

/** Text styles shared across screens. */
export const type = StyleSheet.create({
  /** Numbers (and any English) in Fugaz One; Chinese in the same text stays in the system font. */
  num: {
    fontFamily: tokens.font.display,
    fontWeight: tokens.fontWeight.regular,
  },
  /** A form or section label above its control. */
  sectionLabel: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.semibold,
  },
});
