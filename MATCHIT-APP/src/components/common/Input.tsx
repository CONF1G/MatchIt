// src/components/common/Input.tsx
// Componentă Input reutilizabilă cu suport pentru toate cazurile din aplicație.

import { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, Pressable,
  TextInputProps, ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../config/theme";

// ─── Tipuri ───────────────────────────────────────────────────────────────────

type InputVariant = "default" | "error" | "success";

export interface InputProps extends Omit<TextInputProps, "style"> {
  /** Label afișat deasupra input-ului */
  label?: string;
  /** Mesaj de eroare afișat sub input */
  error?: string;
  /** Mesaj de succes afișat sub input */
  hint?: string;
  /** Icon afișat la stânga */
  leftIcon?: keyof typeof Ionicons.glyphMap;
  /** Icon afișat la dreapta (ex: toggle parolă) */
  rightIcon?: keyof typeof Ionicons.glyphMap;
  /** Callback la apăsarea iconului din dreapta */
  onRightIconPress?: () => void;
  /** Stiluri externe pentru container */
  containerStyle?: ViewStyle;
  /** Dacă true, afișează un toggle show/hide parolă automat */
  isPassword?: boolean;
  /** Număr de caractere rămase (pentru bio, comentarii) */
  maxLength?: number;
  showCharCount?: boolean;
}

// ─── Componenta ───────────────────────────────────────────────────────────────

/**
 * Reusable text input with optional label, left/right icons, validation messaging, and visual state (focus/error).
 *
 * @param label - Optional text shown above the input
 * @param error - Error message shown below the input; when present, applies error styling and takes priority over `hint`
 * @param hint - Informational text shown below the input when `error` is not provided
 * @param leftIcon - Ionicons glyph name to render on the left side of the input
 * @param rightIcon - Ionicons glyph name to render on the right side of the input (ignored when `isPassword` is true)
 * @param onRightIconPress - Callback invoked when the right icon is pressed (ignored when `isPassword` is true)
 * @param containerStyle - Style object applied to the outer container View
 * @param isPassword - When true, enables password mode and renders a built-in toggle icon to show/hide the value
 * @param maxLength - Maximum number of characters accepted by the input; used for both TextInput limitation and optional character counter
 * @param showCharCount - When true and `maxLength` is provided, shows a character counter (current/maximum)
 * @param value - Controlled input value (string)
 * @returns A React element representing the rendered input component
 */
export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  isPassword = false,
  maxLength,
  showCharCount = false,
  value,
  ...textInputProps
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused,    setIsFocused]    = useState(false);

  const variant: InputVariant = error ? "error" : "default";
  const charCount = typeof value === "string" ? value.length : 0;

  // Dacă e câmp de parolă, gestionăm show/hide intern
  const effectiveSecureEntry = isPassword ? !showPassword : textInputProps.secureTextEntry;
  const effectiveRightIcon   = isPassword
    ? (showPassword ? "eye-off-outline" : "eye-outline") as keyof typeof Ionicons.glyphMap
    : rightIcon;
  const effectiveRightPress  = isPassword
    ? () => setShowPassword((v) => !v)
    : onRightIconPress;

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Label */}
      {label && (
        <Text style={styles.label}>{label}</Text>
      )}

      {/* Input wrapper */}
      <View
        style={[
          styles.wrapper,
          isFocused && styles.wrapperFocused,
          variant === "error" && styles.wrapperError,
        ]}
      >
        {/* Icon stânga */}
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={18}
            color={isFocused ? COLORS.accent : COLORS.textMuted}
            style={styles.leftIcon}
          />
        )}

        {/* Input nativ */}
        <TextInput
          style={styles.input}
          placeholderTextColor={COLORS.textMuted}
          selectionColor={COLORS.accent}
          value={value}
          maxLength={maxLength}
          secureTextEntry={effectiveSecureEntry}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...textInputProps}
        />

        {/* Icon dreapta */}
        {effectiveRightIcon && (
          <Pressable
            onPress={effectiveRightPress}
            hitSlop={12}
            style={styles.rightIcon}
          >
            <Ionicons
              name={effectiveRightIcon}
              size={18}
              color={COLORS.textMuted}
            />
          </Pressable>
        )}
      </View>

      {/* Footer: eroare / hint / char count */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}
          {!error && hint && (
            <Text style={styles.hintText}>{hint}</Text>
          )}
        </View>

        {showCharCount && maxLength && (
          <Text style={[
            styles.charCount,
            charCount >= maxLength && styles.charCountMax,
          ]}>
            {charCount}/{maxLength}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Stiluri ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: SPACING.xs,
  },
  label: {
    color:       COLORS.textSecondary,
    fontSize:    FONT_SIZE.sm,
    fontWeight:  "600",
    marginLeft:  2,
  },
  wrapper: {
    flexDirection:   "row",
    alignItems:      "center",
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm + 2,
    minHeight:       48,
  },
  wrapperFocused: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.surfaceHigh,
  },
  wrapperError: {
    borderColor: COLORS.danger,
  },
  leftIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex:      1,
    color:     COLORS.text,
    fontSize:  FONT_SIZE.base,
    padding:   0,
  },
  rightIcon: {
    marginLeft: SPACING.sm,
    padding:    2,
  },
  footer: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    paddingHorizontal: 2,
  },
  footerLeft: {
    flex: 1,
  },
  errorText: {
    color:    COLORS.danger,
    fontSize: FONT_SIZE.xs,
  },
  hintText: {
    color:    COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
  },
  charCount: {
    color:    COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: "600",
  },
  charCountMax: {
    color: COLORS.danger,
  },
});