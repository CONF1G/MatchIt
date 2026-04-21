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
 * Render a customizable button supporting visual variants, sizes, optional icons, and a loading state.
 *
 * When `loading` is true the button shows an activity indicator and is non-interactive; the button is also non-interactive when `disabled` is true.
 *
 * @param label - Button text label
 * @param onPress - Callback executed when the button is pressed
 * @param variant - Visual variant; e.g. `"primary" | "secondary" | "danger"` (controls background, border, and text colors)
 * @param size - Button size; one of `"sm" | "md" | "lg"` (controls padding, font size, icon size, and corner radius)
 * @param loading - Show a spinner in place of the label/icons and disable interaction while true
 * @param disabled - Disable interaction and apply disabled styling when true
 * @param leftIcon - Optional Ionicons glyph name to render at the start of the label
 * @param rightIcon - Optional Ionicons glyph name to render at the end of the label
 * @param fullWidth - Expand the button to fill available width when true
 * @param style - Optional container style overrides
 * @param textStyle - Optional text style overrides for the label
 * @returns The rendered Button element
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