import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '../theme/tokens';

const TAB_SCREEN_EDGES = ['top', 'left', 'right'] as const;

type ScreenProps = {
  children: ReactNode;
  centered?: boolean;
  inTabs?: boolean;
  /** Pinned to the bottom above the content, whatever is scrolled (a short-lived result line). */
  overlay?: ReactNode;
};

/**
 * Full-screen container: safe area, keyboard avoidance and scrolling for form screens.
 * `inTabs`: the tab bar already covers the bottom inset, so leave it out.
 */
export function Screen({ children, centered = false, inTabs = false, overlay }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={inTabs ? TAB_SCREEN_EDGES : undefined}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          indicatorStyle="white"
          contentContainerStyle={[styles.content, centered && styles.centered]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.column}>{children}</View>
        </ScrollView>
        {overlay ? (
          // Taps go through to what is under it.
          <View pointerEvents="none" style={styles.overlay}>
            <View style={styles.column}>{overlay}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: tokens.color.background,
  },
  flex: {
    flex: 1,
  },
  // One page margin for every screen, so titles, cards and buttons share a left edge.
  content: {
    flexGrow: 1,
    paddingHorizontal: tokens.space.lg,
    paddingTop: tokens.space.lg,
    paddingBottom: tokens.space.xxl,
  },
  centered: {
    justifyContent: 'center',
  },
  column: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: tokens.space.lg,
  },
  overlay: {
    position: 'absolute',
    left: tokens.space.lg,
    right: tokens.space.lg,
    bottom: tokens.space.lg,
  },
});
