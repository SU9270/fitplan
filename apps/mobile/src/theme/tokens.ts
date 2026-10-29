/**
 * Design tokens taken from the FitPlan UI sketch. Screens style themselves with
 * React Native `StyleSheet` + these values only — no ad-hoc colors or sizes.
 */
export const tokens = {
  color: {
    /** App background (底色) */
    background: '#F4F6F2',
    /** Cards, inputs */
    surface: '#FFFFFF',
    /** Primary text (文字) */
    text: '#17211C',
    /** Secondary text (次要文字) */
    textSecondary: '#5B6660',
    /** Brand / primary actions (主色) */
    primary: '#2D7A52',
    /** Tinted background for primary elements (主色浅底) */
    primarySoft: '#E5F1EA',
    /** Text on primary-colored surfaces */
    onPrimary: '#FFFFFF',
    /** Hairlines and input borders */
    border: '#D9DFD9',
    /** Error messages */
    danger: '#B42318',
    /** Macro colors */
    protein: '#3461C7',
    carbs: '#E3A13A',
    fat: '#D2667A',
    vegetable: '#3E9C63',
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
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
  fontSize: {
    caption: 13,
    body: 16,
    subtitle: 18,
    title: 24,
    display: 32,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  /** Minimum touch target (Apple HIG: 44pt). */
  touchTarget: 44,
} as const;

export type Tokens = typeof tokens;
