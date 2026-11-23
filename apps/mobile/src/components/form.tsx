import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { tokens } from '../theme/tokens';

type TextFieldProps = Omit<TextInputProps, 'style' | 'accessibilityLabel'> & {
  label: string;
  /** Extra spoken context, e.g. the password rule. */
  hint?: string;
};

/** Labelled text input; the visible label doubles as the accessibility label. The border turns yellow while typing. */
export function TextField({ label, hint, onFocus, onBlur, ...inputProps }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={tokens.color.textTertiary}
        selectionColor={tokens.color.primary}
        keyboardAppearance="dark"
        style={[styles.input, focused && styles.inputFocused]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...inputProps}
      />
    </View>
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
};

/** The screen's one main action: a tall yellow button. */
export function PrimaryButton({ title, onPress, busy = false, disabled = false }: ButtonProps) {
  const inactive = busy || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed, inactive && styles.inactive]}
    >
      {busy ? (
        <ActivityIndicator color={tokens.color.onPrimary} />
      ) : (
        <Text style={styles.primaryText}>{title}</Text>
      )}
    </Pressable>
  );
}

type SoftButtonProps = ButtonProps & {
  accessibilityLabel?: string;
  /** A dashed outline instead of a tint: "an empty slot to fill", for "+ 添加". */
  dashed?: boolean;
};

/** Medium-emphasis action: yellow text on a yellow tint, e.g. "复制昨天" or "保存" inside a card. */
export function SoftButton({ title, onPress, accessibilityLabel, disabled = false, dashed = false }: SoftButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.soft, dashed && styles.dashed, pressed && styles.pressed, disabled && styles.inactive]}
    >
      <Text style={styles.softText}>{title}</Text>
    </Pressable>
  );
}

type TextButtonProps = ButtonProps & {
  accessibilityLabel?: string;
  /** quiet: gray, for ways out (back, cancel, sign out, language) that should not compete with the screen's actions. */
  tone?: 'primary' | 'quiet';
};

/** Low-emphasis text action (links between screens, language switch, sign-out). */
export function TextButton({ title, onPress, accessibilityLabel, disabled = false, tone = 'primary' }: TextButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={tokens.space.sm}
      onPress={onPress}
      style={({ pressed }) => [styles.textButton, pressed && styles.pressed, disabled && styles.inactive]}
    >
      <Text style={[styles.textButtonText, tone === 'quiet' && styles.textButtonQuiet]}>{title}</Text>
    </Pressable>
  );
}

/** Inline error, announced by screen readers when it appears. */
export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: tokens.space.sm,
  },
  label: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.semibold,
  },
  input: {
    minHeight: tokens.controlHeight,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.md,
    borderWidth: 1.5,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.field,
    color: tokens.color.text,
    fontSize: tokens.fontSize.body,
  },
  inputFocused: {
    borderColor: tokens.color.primary,
  },
  primary: {
    minHeight: tokens.controlHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.space.lg,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.primary,
  },
  primaryPressed: {
    backgroundColor: tokens.color.primaryPressed,
  },
  inactive: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.6,
  },
  primaryText: {
    color: tokens.color.onPrimary,
    fontSize: tokens.fontSize.body + 1,
    fontWeight: tokens.fontWeight.heavy,
  },
  soft: {
    minHeight: tokens.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.space.lg,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.primarySoft,
  },
  dashed: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.color.borderStrong,
    backgroundColor: 'transparent',
  },
  softText: {
    color: tokens.color.primary,
    fontSize: tokens.fontSize.label + 1,
    fontWeight: tokens.fontWeight.bold,
  },
  textButton: {
    minHeight: tokens.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.space.sm,
  },
  textButtonText: {
    color: tokens.color.primary,
    fontSize: tokens.fontSize.label + 1,
    fontWeight: tokens.fontWeight.semibold,
  },
  textButtonQuiet: {
    color: tokens.color.textSecondary,
    fontWeight: tokens.fontWeight.medium,
  },
  error: {
    color: tokens.color.danger,
    fontSize: tokens.fontSize.caption,
  },
});
