import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { tokens } from '../theme/tokens';

/** A standalone ticket's text inset: the same as a card header's, measured from the card's edge. */
const INSET = tokens.card.padding + tokens.card.headerInset;
/** Inside a card the ticket is a tile, so its text starts where a tile's does. */
const NESTED_INSET = tokens.card.tilePaddingX;

const InsetContext = createContext(INSET);

/** The horizontal inset of the ticket this is rendered in, for content laid out outside a `TicketSection`. */
export function useTicketInset(): number {
  return useContext(InsetContext);
}

type TicketProps = {
  children: ReactNode;
  /** Inside a card: the smaller corner that nests in the card's. */
  nested?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/**
 * Paper-white block for what the app hands the user: a meal's feedback with its one-tap
 * adjustments, the estimated daily target. Text on it uses `tokens.color.onPaper`.
 * Lay it out as `TicketSection`s separated by `Perforation`s.
 */
export function Ticket({ children, nested = false, style, accessibilityLabel }: TicketProps) {
  return (
    <InsetContext.Provider value={nested ? NESTED_INSET : INSET}>
      <View accessibilityLabel={accessibilityLabel} style={[styles.ticket, nested && styles.nested, style]}>
        {children}
      </View>
    </InsetContext.Provider>
  );
}

/** A padded part of a ticket (or of a card that has a perforation). */
export function TicketSection({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const inset = useTicketInset();
  return <View style={[styles.section, { paddingHorizontal: inset }, style]}>{children}</View>;
}

type PerforationProps = {
  /** Color of the dashes. */
  color?: string;
  /** Color of what is behind the ticket: the two half-round notches are painted in it. */
  notch: string;
};

const NOTCH = 18;
const DASH = 2;

/** A tear line across a ticket: dashes, and a half-round notch cut out of each edge. */
export function Perforation({ color = tokens.color.paperBorder, notch }: PerforationProps) {
  // The dashes start on the text inset, but never inside a notch.
  const inset = Math.max(useTicketInset(), NOTCH / 2 + tokens.space.xs);
  return (
    <View style={styles.perforation} accessible={false}>
      <View style={{ marginHorizontal: inset }}>
        <Svg width="100%" height={DASH}>
          <Line x1="0" y1={DASH / 2} x2="100%" y2={DASH / 2} stroke={color} strokeWidth={DASH} strokeDasharray="6 5" strokeLinecap="round" />
        </Svg>
      </View>
      <View style={[styles.notch, styles.notchLeft, { backgroundColor: notch }]} />
      <View style={[styles.notch, styles.notchRight, { backgroundColor: notch }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: {
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.paper,
  },
  nested: {
    borderRadius: tokens.radius.md,
  },
  section: {
    gap: tokens.space.sm,
    paddingVertical: tokens.space.md,
  },
  perforation: {
    height: DASH,
    justifyContent: 'center',
  },
  notch: {
    position: 'absolute',
    top: (DASH - NOTCH) / 2,
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
  },
  notchLeft: {
    left: -NOTCH / 2,
  },
  notchRight: {
    right: -NOTCH / 2,
  },
});
