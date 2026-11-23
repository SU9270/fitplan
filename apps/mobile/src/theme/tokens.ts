/**
 * Design tokens for the black-and-yellow theme ("race day"): a near-black page, dark cards that
 * get lighter as they come closer, one yellow for the main action and the key numbers, and
 * paper-white "tickets" for what the app hands the user (meal feedback, the daily target).
 * Screens style themselves with React Native `StyleSheet` + these values only — no ad-hoc
 * colors or sizes.
 *
 * Depth on a dark page comes from lightness, not shadows (a dark shadow on black is invisible):
 * background → card → surface → surfaceRaised, each a step lighter; `field` is the one step
 * darker, for inputs set into a card.
 */
export const tokens = {
  color: {
    /** Page background (ink). */
    background: '#0B0B0C',
    /** Card shell: the block that groups tiles. */
    card: '#161618',
    /** Hairline around a card, so its edge reads against the page. */
    cardBorder: '#222225',
    /** Tiles, rows and chips inside a card. */
    surface: '#202023',
    /** Pressed tiles, quiet buttons on a tile. */
    surfaceRaised: '#2A2A2E',
    /** Text inputs and the segmented-control track: darker than what they sit in (inset). */
    field: '#0F0F10',
    /** Primary text (paper white; pure white on black glares). */
    text: '#F4F1EA',
    /** Labels, units, hints. 7:1 on a card. */
    textSecondary: '#A3A19B',
    /** Placeholders, the small English labels. 4.7:1 on a tile. */
    textTertiary: '#8A8883',
    /** Brand yellow: the main action of a screen and its key numbers. */
    primary: '#FFD23F',
    /** Pressed primary. */
    primaryPressed: '#E6BA2E',
    /** Tinted background for soft primary elements (yellow at 14 %). */
    primarySoft: 'rgba(255, 210, 63, 0.14)',
    /** Text on yellow. */
    onPrimary: '#0B0B0C',
    /** Quieter text on yellow: a dark shade of the yellow itself, never gray. */
    onPrimarySecondary: '#4D3F0A',
    /** Hairlines, input borders. */
    border: '#2A2A2E',
    /** Stronger borders: checkboxes, dashed "add" buttons. */
    borderStrong: '#3A3A3F',
    /** Form errors only (never for nutrition feedback, requirements §3.3). */
    danger: '#FF8A7A',
    /** Border of a card that asks for attention. */
    warning: '#FFD23F',
    /** Done / enough. */
    success: '#3DDC84',
    /** Ticket paper and the text on it. */
    paper: '#F4F1EA',
    onPaper: '#0B0B0C',
    onPaperSecondary: '#5E5B55',
    /** Tiles on a ticket, and the plate behind a food picture (the pictures have a white background). */
    paperTile: '#FFFFFF',
    /** Perforation and hairlines on a ticket. */
    paperBorder: '#D3CCBD',
    /** Dots on a ticket: "enough" in a green dark enough for paper, and a quiet gray. */
    paperMet: '#23A05A',
    paperQuiet: '#9A958B',
    /** Nutrient colors and their ring tracks (the color at 16 %). */
    kcal: '#FFD23F',
    kcalTrack: 'rgba(255, 210, 63, 0.16)',
    protein: '#6CC4FF',
    proteinTrack: 'rgba(108, 196, 255, 0.16)',
    carbs: '#FF9F5A',
    carbsTrack: 'rgba(255, 159, 90, 0.16)',
    fat: '#E08CFF',
    fatTrack: 'rgba(224, 140, 255, 0.16)',
    /** Plate cells: protein and staple reuse the protein / carbs colors. */
    vegetable: '#9BE564',
    otherFood: '#8A8883',
  },
  /**
   * Corners nest: a card's radius minus its padding is its tiles' radius (24 − 10 = 14), and a
   * tile's minus the segmented control's padding is a segment's (14 − 4 = 10).
   */
  radius: {
    /** Small chips, badges, checkboxes. */
    sm: 8,
    /** Segments inside a segmented control. */
    inner: 10,
    /** Tiles, inputs, buttons. */
    md: 14,
    /** Card shells, banners, tickets. */
    lg: 24,
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
  /** Card measurements: every card, ticket and banner uses the same inset, so text lines up down the page. */
  card: {
    /** Shell padding around the tiles. */
    padding: 10,
    /** Space between tiles. */
    gap: 6,
    /** Inset of the header text: the same as a tile's, so both start on one line. */
    headerInset: 10,
    /** Tile padding. */
    tilePaddingX: 10,
    tilePaddingY: 10,
  },
  /** Space between a label and its value. */
  hairline: 2,
  fontSize: {
    /** The small English labels ("BREAKFAST"). */
    micro: 11,
    caption: 13,
    label: 14,
    body: 16,
    subtitle: 18,
    title: 22,
    display: 30,
    /** Page titles. */
    hero: 40,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    heavy: '900',
  },
  font: {
    /** Fugaz One: numbers and the small English labels. It has no Chinese glyphs, so Chinese in the same text falls back to the system font. */
    display: 'FugazOne_400Regular',
  },
  /** How far titles lean to the right, to match Fugaz One (the system Chinese font has no italic). */
  titleSkew: '-9deg',
  shadow: {
    /** The selected segment: a faint edge under it. */
    raised: {
      shadowColor: '#000000',
      shadowOpacity: 0.3,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    /** Things that float over the page (the "added" line): a wide, soft shadow. */
    floating: {
      shadowColor: '#000000',
      shadowOpacity: 0.5,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
  },
  /** Minimum touch target (Apple HIG: 44pt). */
  touchTarget: 44,
  /** Height of a screen's main button and of standalone inputs. */
  controlHeight: 52,
} as const;

export type Tokens = typeof tokens;
