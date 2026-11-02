/**
 * Design tokens, after the BoardUI design system (boardui.com): white pages, light-gray card
 * shells holding white tiles, blue primary, vivid chart colors. Values are BoardUI's (its
 * Tailwind v4 palette: neutral, blue accent, teal / sky / yellow / pink chart colors).
 * Screens style themselves with React Native `StyleSheet` + these values only — no ad-hoc
 * colors or sizes.
 */
export const tokens = {
  color: {
    /** Page background (white). */
    background: '#FFFFFF',
    /** Card shell: the light-gray block that groups tiles (neutral-100). */
    card: '#F7F7F7',
    /** Tiles, rows, inputs and chips inside or outside a card (white). */
    surface: '#FFFFFF',
    /** Primary text (neutral-950). */
    text: '#0A0A0A',
    /** Labels, units, hints (neutral-500). */
    textSecondary: '#737373',
    /** Placeholders and disabled text (neutral-400). */
    textTertiary: '#A1A1A1',
    /** Brand / primary actions (accent-500). */
    primary: '#2B7FFF',
    /** Pressed primary (accent-600). */
    primaryPressed: '#155DFC',
    /** Tinted background for soft primary elements (accent-100). */
    primarySoft: '#DBEAFE',
    /** Text on primary-colored surfaces. */
    onPrimary: '#FFFFFF',
    /** Hairlines, input borders, segmented-control track (neutral-200). */
    border: '#EBEBEB',
    /** Hovered / stronger borders (neutral-300). */
    borderStrong: '#D4D4D4',
    /** Error text (red-500). */
    danger: '#FB2C36',
    /** Tinted background for errors and "over target" (red-100). */
    dangerSoft: '#FFE2E2',
    /** Warning border (yellow-400). */
    warning: '#FDC700',
    /** Nutrient colors (BoardUI chart colors) and their ring tracks (~20 % tints). */
    kcal: '#00D5BE',
    kcalTrack: '#CCF7F2',
    protein: '#00BCFF',
    proteinTrack: '#CCF2FF',
    carbs: '#FDC700',
    carbsTrack: '#FFF4C2',
    fat: '#FB64B6',
    fatTrack: '#FEE0F0',
  },
  radius: {
    /** Small chips and badges. */
    sm: 8,
    /** Tiles, inputs, buttons. */
    md: 10,
    /** Card shells. */
    lg: 20,
    pill: 999,
  },
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  /** BoardUI card measurements (its card shell and tiles). */
  card: {
    /** Shell padding around the tiles. */
    padding: 10,
    /** Space between tiles. */
    gap: 6,
    /** Extra inset of the header text, so it lines up with the tiles' text. */
    headerInset: 6,
    /** Tile padding. */
    tilePaddingX: 10,
    tilePaddingY: 8,
  },
  /** Space between a label and its value. */
  hairline: 2,
  fontSize: {
    caption: 13,
    label: 14,
    body: 16,
    subtitle: 18,
    title: 22,
    display: 30,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  /** BoardUI's raised element (selected segment): a faint 1 px shadow. */
  shadow: {
    raised: {
      shadowColor: '#0A0A0A',
      shadowOpacity: 0.08,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
  },
  /** Minimum touch target (Apple HIG: 44pt). */
  touchTarget: 44,
} as const;

export type Tokens = typeof tokens;
