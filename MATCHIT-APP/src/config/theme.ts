// src/config/theme.ts
// Sursa unică de adevăr pentru toate stilurile vizuale ale aplicației.
// Importă din acest fișier oriunde ai nevoie de culori, spații sau fonturi.
// NU hardcoda niciodată valori de culoare sau dimensiune direct în componente.

import { Platform, TextStyle } from "react-native";

// ─── CULORI ───────────────────────────────────────────────────────────────────

export const COLORS = {
  // ── Fundal ────────────────────────────────────────────────────────────────
  bg:              "#0D0D0D",   // fundalul principal al tuturor ecranelor
  surface:         "#1A1A1A",   // carduri, input-uri, bottom bar
  surfaceHigh:     "#242424",   // elemente ridicate deasupra surface
  surfaceHighest:  "#2E2E2E",   // cel mai ridicat nivel (tooltip-uri, etc.)

  // ── Accent principal — lime electric ─────────────────────────────────────
  accent:          "#E8FF47",   // butoane principale, highlight-uri
  accentDim:       "#B8CC38",   // accent mai puțin intens (host label, waiting)
  accentSubtle:    "#E8FF4714", // accent cu ~8% opacitate (background subtle)
  accentHover:     "#D4EB3A",   // accent la hover/press

  // ── Text ──────────────────────────────────────────────────────────────────
  text:            "#F0F0F0",   // text principal
  textSecondary:   "#AAAAAA",   // text secundar (subtitluri, meta)
  textMuted:       "#666666",   // text discret (placeholder, timp, label-uri)
  textInverse:     "#0D0D0D",   // text pe fundal deschis (ex: pe buton accent)

  // ── Semantic ──────────────────────────────────────────────────────────────
  success:         "#47FF9C",   // stare OK, online, ready
  successSubtle:   "#47FF9C14",
  danger:          "#FF5C5C",   // erori, ștergere, likes
  dangerSubtle:    "#FF5C5C14",
  warning:         "#FFB347",   // avertismente
  warningSubtle:   "#FFB34714",
  info:            "#5C9EFF",   // informații, lobby invites
  infoSubtle:      "#5C9EFF14",

  // ── Borduri ───────────────────────────────────────────────────────────────
  border:          "#2A2A2A",   // borduri subtile standard
  borderLight:     "#3A3A3A",   // borduri mai vizibile (focus, selected)
  borderAccent:    "#E8FF4740", // bordură accent cu opacitate

  // ── Overlay ───────────────────────────────────────────────────────────────
  overlay:         "rgba(0, 0, 0, 0.6)",
  overlayLight:    "rgba(0, 0, 0, 0.3)",
} as const;

export type ColorKey = keyof typeof COLORS;

// ─── TIPOGRAFIE ───────────────────────────────────────────────────────────────

export const FONT_SIZE = {
  xs:    11,
  sm:    12,
  md:    14,
  base:  15,
  lg:    17,
  xl:    20,
  xxl:   24,
  xxxl:  28,
  huge:  36,
} as const;

export const FONT_WEIGHT = {
  regular:   "400" as TextStyle["fontWeight"],
  medium:    "500" as TextStyle["fontWeight"],
  semibold:  "600" as TextStyle["fontWeight"],
  bold:      "700" as TextStyle["fontWeight"],
  extrabold: "800" as TextStyle["fontWeight"],
  black:     "900" as TextStyle["fontWeight"],
} as const;

export const LINE_HEIGHT = {
  tight:   1.2,
  normal:  1.5,
  relaxed: 1.75,
} as const;

export const LETTER_SPACING = {
  tight:   -0.5,
  normal:   0,
  wide:     0.5,
  wider:    1.0,
  widest:   1.5,
} as const;

// ─── SPAȚIERE ─────────────────────────────────────────────────────────────────
// Sistem de 4px — toate valorile sunt multipli de 4

export const SPACING = {
  xs:   4,
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  xxl:  48,
  xxxl: 64,
} as const;

export type SpacingKey = keyof typeof SPACING;

// ─── BORDER RADIUS ────────────────────────────────────────────────────────────

export const RADIUS = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  xxl:  32,
  full: 9999,
} as const;

export type RadiusKey = keyof typeof RADIUS;

// ─── UMBRE ────────────────────────────────────────────────────────────────────

export const SHADOW = {
  none: {},

  xs: Platform.select({
    ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 2  },
    android: { elevation: 1 },
  }),

  sm: Platform.select({
    ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4  },
    android: { elevation: 2 },
  }),

  md: Platform.select({
    ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.20, shadowRadius: 8  },
    android: { elevation: 4 },
  }),

  lg: Platform.select({
    ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16 },
    android: { elevation: 8 },
  }),

  accent: Platform.select({
    ios:     { shadowColor: "#E8FF47", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 },
    android: { elevation: 6 },
  }),

  card: Platform.select({
    ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.30, shadowRadius: 20 },
    android: { elevation: 10 },
  }),
} as const;

// ─── DIMENSIUNI FIXE ─────────────────────────────────────────────────────────

export const SIZE = {
  avatarXs:  24,
  avatarSm:  32,
  avatarMd:  40,
  avatarLg:  56,
  avatarXl:  80,
  avatarXxl: 96,

  tabBarHeight:    56,
  tabBarIconSize:  22,
  tabBarIconSizeLg: 32,

  headerHeight: 52,

  catalogCardImageHeight: 140,

  buttonHeightSm: 36,
  buttonHeightMd: 44,
  buttonHeightLg: 52,

  inputHeight: 48,

  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  iconXl: 32,
} as const;

// ─── ANIMAȚII ────────────────────────────────────────────────────────────────

export const ANIMATION = {
  durationFast:   150,
  durationNormal: 300,
  durationSlow:   500,
  durationLazy:   800,
  staggerDelay:    60,
} as const;

// ─── TIPURI COMPUSE ───────────────────────────────────────────────────────────

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type BadgeVariant  = "accent" | "success" | "danger" | "warning" | "info" | "muted";
export type InputVariant  = "default" | "error" | "success";

export const VARIANT_COLORS: Record<ButtonVariant, { bg: string; text: string; border: string }> = {
  primary:   { bg: COLORS.accent,   text: COLORS.textInverse, border: COLORS.accent   },
  secondary: { bg: COLORS.surface,  text: COLORS.text,        border: COLORS.border   },
  ghost:     { bg: "transparent",   text: COLORS.text,        border: "transparent"   },
  danger:    { bg: COLORS.danger,   text: "#fff",             border: COLORS.danger   },
  success:   { bg: COLORS.success,  text: COLORS.textInverse, border: COLORS.success  },
};

export const BADGE_COLORS: Record<BadgeVariant, { bg: string; text: string }> = {
  accent:  { bg: COLORS.accentSubtle,  text: COLORS.accent   },
  success: { bg: COLORS.successSubtle, text: COLORS.success  },
  danger:  { bg: COLORS.dangerSubtle,  text: COLORS.danger   },
  warning: { bg: COLORS.warningSubtle, text: COLORS.warning  },
  info:    { bg: COLORS.infoSubtle,    text: COLORS.info     },
  muted:   { bg: COLORS.surfaceHigh,   text: COLORS.textMuted},
};