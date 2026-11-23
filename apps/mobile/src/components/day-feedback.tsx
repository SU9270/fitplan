import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { entryName } from '../diary/efficiency';
import { feedbackItems, feedbackSummary, suggestionText, type DayFeedback as Feedback, type FeedbackTone, type SuggestionView } from '../diary/plate-view';
import { useLocale } from '../i18n';
import { tokens } from '../theme/tokens';
import { type } from './display';
import { Perforation, Ticket, TicketSection } from './ticket';

/** A ticket inside a card is inset like a tile (see `Ticket`). */
const TICKET_INSET = tokens.card.tilePaddingX;

type Props = {
  feedback: Feedback;
  onApply: (suggestion: SuggestionView) => void;
  /** Suggestions are disabled while one is being applied. */
  applying: boolean;
};

/** Dot color per feedback tone on the dark card: yellow for what is still missing, green for enough (no red, §3.3). */
const TONE_COLORS: Record<FeedbackTone, string> = {
  short: tokens.color.primary,
  met: tokens.color.success,
  hint: tokens.color.primary,
};

/** The same on the paper ticket, where yellow would not show: black for what is missing. */
const PAPER_TONE_COLORS: Record<FeedbackTone, string> = {
  short: tokens.color.onPaper,
  met: tokens.color.paperMet,
  hint: tokens.color.onPaper,
};

/**
 * The whole day against the daily target, short by default: one line naming what is still short,
 * and nothing at all when nothing is (`feedbackSummary` is null; the screen then drops the card).
 * Tapping it tears open a paper ticket with the details: the gap as tags with numbers and up to
 * three one-tap adjustments (requirements §3.3), which go to `feedback.meal`. Meals are not
 * compared one by one, and the screen shows this only once dinner has something logged.
 */
export function DayFeedback({ feedback, onApply, applying }: Props) {
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const name = (item: { name: string; nameZh: string | null; quick?: boolean }) => entryName(item, locale, t);
  const items = feedbackItems(feedback, t);
  const summary = feedbackSummary(feedback, t);
  if (summary === null) return null;

  const hasSuggestions = feedback.suggestions.length > 0;
  const toggleLabel = open ? t('plate.collapse') : t(hasSuggestions ? 'plate.showSuggestions' : 'plate.showDetails');
  // The yellow pill is for a day the user can do something about; otherwise the toggle stays quiet.
  const callsForAction = hasSuggestions;

  if (!open) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${summary.text}, ${toggleLabel}`}
        accessibilityState={{ expanded: false }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
      >
        <View style={[styles.dot, { backgroundColor: TONE_COLORS[summary.tone] }]} />
        <Text style={styles.summaryText} numberOfLines={1}>
          {summary.text}
        </Text>
        <View style={[styles.pill, callsForAction && styles.pillPrimary]}>
          <Text style={[styles.pillText, callsForAction && styles.pillTextPrimary]}>{toggleLabel}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Ticket nested>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${summary.text}, ${toggleLabel}`}
        accessibilityState={{ expanded: true }}
        onPress={() => setOpen(false)}
        style={({ pressed }) => [styles.ticketHead, pressed && styles.pressed]}
      >
        <Text style={styles.ticketTitle} numberOfLines={1}>
          {summary.text}
        </Text>
        <Text style={styles.ticketToggle}>{toggleLabel}</Text>
        <Ionicons name="chevron-up" size={tokens.fontSize.label} color={tokens.color.onPaperSecondary} />
      </Pressable>
      <TicketSection style={styles.tagsSection}>
        <View style={styles.tags} accessible accessibilityLiveRegion="polite">
          {items.map((item) => (
            <View key={item.text} style={styles.tag}>
              <View style={[styles.dot, { backgroundColor: PAPER_TONE_COLORS[item.tone] }]} />
              <Text style={[styles.tagText, item.tone === 'met' && styles.tagQuiet]}>{item.text}</Text>
            </View>
          ))}
        </View>
      </TicketSection>

      {hasSuggestions ? (
        <>
          <Perforation notch={tokens.color.card} />
          <TicketSection>
            <Text style={styles.suggestTitle}>{t('suggest.title', { meal: t(`meal.${feedback.meal}`) })}</Text>
            {feedback.suggestions.map((s) => {
              const { action, effect } = suggestionText(s, name, t);
              return (
                <View key={s.kind === 'add' ? `add-${s.foodId}` : `adjust-${s.entryId}`} style={styles.suggestion}>
                  <View style={styles.suggestionTexts}>
                    <Text style={styles.suggestionAction}>{action}</Text>
                    <Text style={[type.num, styles.suggestionEffect]}>{effect}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('suggest.applyLabel', { text: action })}
                    accessibilityState={{ disabled: applying }}
                    disabled={applying}
                    onPress={() => onApply(s)}
                    style={({ pressed }) => [styles.apply, (pressed || applying) && styles.pressed]}
                  >
                    <Text style={styles.applyText}>{t('suggest.apply')}</Text>
                  </Pressable>
                </View>
              );
            })}
          </TicketSection>
        </>
      ) : null}
    </Ticket>
  );
}

const DOT = 8;
/** The "看建议" pill and the "应用" button. */
const PILL_HEIGHT = 36;

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.6,
  },
  summary: {
    minHeight: tokens.touchTarget + tokens.space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm + tokens.hairline,
    paddingLeft: tokens.card.tilePaddingX,
    paddingRight: tokens.space.sm,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
  },
  summaryText: {
    flex: 1,
    color: tokens.color.text,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.bold,
  },
  pill: {
    height: PILL_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: tokens.space.lg,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.surfaceRaised,
  },
  pillPrimary: {
    backgroundColor: tokens.color.primary,
  },
  pillText: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.bold,
  },
  pillTextPrimary: {
    color: tokens.color.onPrimary,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  ticketHead: {
    minHeight: tokens.touchTarget + tokens.space.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.xs,
    paddingHorizontal: TICKET_INSET,
  },
  ticketTitle: {
    flex: 1,
    color: tokens.color.onPaper,
    fontSize: tokens.fontSize.label + 1,
    fontWeight: tokens.fontWeight.heavy,
  },
  ticketToggle: {
    color: tokens.color.onPaperSecondary,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.semibold,
  },
  tagsSection: {
    paddingTop: 0,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.card.gap,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.card.gap,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.card.gap,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.paperTile,
  },
  tagText: {
    color: tokens.color.onPaper,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.semibold,
  },
  tagQuiet: {
    color: tokens.color.onPaperSecondary,
    fontWeight: tokens.fontWeight.medium,
  },
  suggestTitle: {
    color: tokens.color.onPaperSecondary,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.bold,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
  },
  suggestionTexts: {
    flex: 1,
    gap: tokens.hairline,
  },
  suggestionAction: {
    color: tokens.color.onPaper,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.bold,
  },
  suggestionEffect: {
    color: tokens.color.onPaperSecondary,
    fontSize: tokens.fontSize.caption,
  },
  // Black with yellow text: the ticket's own main button (yellow would not show on paper).
  apply: {
    minHeight: tokens.touchTarget,
    minWidth: tokens.touchTarget + tokens.space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.space.lg,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.onPaper,
  },
  applyText: {
    color: tokens.color.primary,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.heavy,
  },
});
