import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '../theme/tokens';

const TAB_SCREEN_EDGES = ['top', 'left', 'right'] as const;

/**
 * Full-screen container: safe area, keyboard avoidance and scrolling for form screens.
 * `inTabs`: the tab bar already covers the bottom inset, so leave it out.
 */
export function Screen({ children, centered = false, inTabs = false }: { children: ReactNode; centered?: boolean; inTabs?: boolean }) {
  return (
    <SafeAreaView style={styles.safe} edges={inTabs ? TAB_SCREEN_EDGES : undefined}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, centered && styles.centered]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.column}>{children}</View>
        </ScrollView>
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
  content: {
    flexGrow: 1,
    padding: tokens.space.xl,
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
});
