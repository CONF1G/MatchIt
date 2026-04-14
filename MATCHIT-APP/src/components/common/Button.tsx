// src/components/common/Button.tsx
// Buton reutilizabil cu toate variantele și stările necesare în aplicație.

import {
  Pressable, Text, StyleSheet, ActivityIndicator,
  ViewStyle, TextStyle, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS, FONT_SIZE, VARIANT_COLORS, ButtonVariant, SHADOW } from "../../config/theme";

// ─── Tipuri ───────────────────────────────────────────────────────────────────

type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  /** Textul butonului */
  label: string;
  /** Callback la apăsare */
  onPress: () => void;
  /** Varianta vizuală */
  variant?: ButtonVariant;
  /** Mărimea butonului */
  size?: ButtonSize;
  /** Afișează spinner în loc de text */
  loading?: boolean;
  /** Dezactivează butonul */
  disabled?: boolean;
  /** Icon la stânga textului */
  leftIcon?: keyof typeof Ionicons.glyphMap;
  /** Icon la dreapta textului */
  rightIcon?: keyof typeof Ionicons.glyphMap;
  /** Ocupă toată lățimea disponibilă */
  fullWidth?: boolean;
  /** Stiluri externe pentru container */
  style?: ViewStyle;
  /** Stiluri externe pentru text */
  textStyle?: TextStyle;
}

// ─── Configurații per mărime ──────────────────────────────────────────────────

const SIZE_CONFIG: Record<ButtonSize, {
  paddingVertical:   number;
  paddingHorizontal: number;
  fontSize:          number;
  iconSize:          number;
  borderRadius:      number;
}> = {
  sm: { paddingVertical: 8,  paddingHorizontal: 14, fontSize: FONT_SIZE.sm,   iconSize: 14, borderRadius: RADIUS.sm },
  md: { paddingVertical: 12, paddingHorizontal: 20, fontSize: FONT_SIZE.base, iconSize: 18, borderRadius: RADIUS.md },
  lg: { paddingVertical: 16, paddingHorizontal: 28, fontSize: FONT_SIZE.lg,   iconSize: 20, borderRadius: RADIUS.lg },
};

// ─── Componenta ───────────────────────────────────────────────────────────────

/**
 * Render a configurable pressable button with optional icons and loading state.
 *
 * Renders a button whose appearance and behavior are controlled by the provided props.
 *
 * @param label - The text shown inside the button.
 * @param onPress - Callback invoked when the button is pressed.
 * @param variant - Visual variant that adjusts colors and border (e.g., "primary", "secondary", "danger"); defaults to "primary".
 * @param size - Visual size that adjusts padding, font and icon sizes; one of "sm", "md", or "lg" (default: "md").
 * @param loading - When true, replaces the label and icons with a loading indicator and disables interaction.
 * @param disabled - When true, visually dims the button and disables interaction.
 * @param leftIcon - Optional Ionicons glyph name to render to the left of the label.
 * @param rightIcon - Optional Ionicons glyph name to render to the right of the label.
 * @param fullWidth - When true, the button expands to fill the container width.
 * @param style - Additional container style to merge with the button's styles.
 * @param textStyle - Additional text style to merge with the label's styles.
 * @returns A pressable button element styled and composed according to the props.
 */
export function Button({
  label,
  onPress,
  variant   = "primary",
  size      = "md",
  loading   = false,
  disabled  = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const colors     = VARIANT_COLORS[variant];
  const sizeConfig = SIZE_CONFIG[size];

  const iconColor = colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor:  colors.bg,
          borderColor:      colors.border,
          paddingVertical:   sizeConfig.paddingVertical,
          paddingHorizontal: sizeConfig.paddingHorizontal,
          borderRadius:      sizeConfig.borderRadius,
        },
        variant === "primary" && SHADOW.accent,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={iconColor}
        />
      ) : (
        <View style={styles.content}>
          {leftIcon && (
            <Ionicons
              name={leftIcon}
              size={sizeConfig.iconSize}
              color={iconColor}
              style={styles.leftIcon}
            />
          )}
          <Text
            style={[
              styles.label,
              { color: colors.text, fontSize: sizeConfig.fontSize },
              textStyle,
            ]}
          >
            {label}
          </Text>
          {rightIcon && (
            <Ionicons
              name={rightIcon}
              size={sizeConfig.iconSize}
              color={iconColor}
              style={styles.rightIcon}
            />
          )}
        </View>
      )}
    </Pressable>
  );
}

// ─── Stiluri ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  base: {
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    flexDirection:   "row",
  },
  content: {
    flexDirection: "row",
    alignItems:    "center",
  },
  fullWidth: {
    width: "100%",
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity:   0.85,
    transform: [{ scale: 0.97 }],
  },
  label: {
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  leftIcon: {
    marginRight: SPACING.xs + 2,
  },
  rightIcon: {
    marginLeft: SPACING.xs + 2,
  },
});