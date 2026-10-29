import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { tokens } from '../theme/tokens';

type TextFieldProps = Omit<TextInputProps, 'style' | 'accessibilityLabel'> & {
  label: string;
  /** Extra spoken context, e.g. the password rule. */
  hint?: string;
};

/** Labelled text input; the visible label doubles as the accessibility label. */
export function TextField({ label, hint, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={tokens.color.textSecondary}
        style={styles.input}
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

export function PrimaryButton({ title, onPress, busy = false, disabled = false }: ButtonProps) {
  const inactive = busy || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.primary, (pressed || inactive) && styles.primaryDimmed]}
    >
      {busy ? (
        <ActivityIndicator color={tokens.color.onPrimary} />
      ) : (
        <Text style={styles.primaryText}>{title}</Text>
      )}
    </Pressable>
  );
}

/** Low-emphasis text action (links between screens, language switch, sign-out). */
export function TextButton({ title, onPress, accessibilityLabel, disabled = false }: ButtonProps & { accessibilityLabel?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={tokens.space.sm}
      onPress={onPress}
      style={({ pressed }) => [styles.textButton, pressed && styles.textButtonPressed]}
    >
      <Text style={styles.textButtonText}>{title}</Text>
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
    gap: tokens.space.xs,
  },
  label: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.semibold,
  },
  input: {
    minHeight: tokens.touchTarget,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
    color: tokens.color.text,
    fontSize: tokens.fontSize.body,
  },
  primary: {
    minHeight: tokens.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.space.lg,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.primary,
  },
  primaryDimmed: {
    opacity: 0.7,
  },
  primaryText: {
    color: tokens.color.onPrimary,
    fontSize: tokens.fontSize.body,
    fontWeight: tokens.fontWeight.semibold,
  },
  textButton: {
    minHeight: tokens.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.space.sm,
  },
  textButtonPressed: {
    opacity: 0.6,
  },
  textButtonText: {
    color: tokens.color.primary,
    fontSize: tokens.fontSize.body,
    fontWeight: tokens.fontWeight.medium,
  },
  error: {
    color: tokens.color.danger,
    fontSize: tokens.fontSize.caption,
  },
});
