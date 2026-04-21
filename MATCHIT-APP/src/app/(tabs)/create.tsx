// src/app/(tabs)/create.tsx
// Ecranul "+" din tab bar.
// Nu conține un formular direct — deschide modalele potrivite.
// Este un "hub" de creare rapidă.

import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

import { COLORS, SPACING, RADIUS, SHADOW } from "../../config/theme";

// ─── Tipuri ───────────────────────────────────────────────────────────────────

type CreateOption = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  route: string;
  accentColor: string;
};

// ─── Opțiuni de creare ────────────────────────────────────────────────────────

const CREATE_OPTIONS: CreateOption[] = [
  {
    id: "catalog",
    icon: "albums",
    title: "Catalog Nou",
    subtitle: "Creează o colecție de carduri/poze",
    route: "/(modals)/create-catalog",
    accentColor: COLORS.accent,
  },
  {
    id: "lobby",
    icon: "game-controller",
    title: "Lobby de Joc",
    subtitle: "Pornește o sesiune de swipe cu prietenii",
    route: "/(modals)/create-lobby",
    accentColor: "#5C9EFF",
  },
  {
    id: "post",
    icon: "image",
    title: "Adaugă Poze",
    subtitle: "Adaugă poze într-un catalog existent",
    route: "/post",
    accentColor: "#47FF9C",
  },
];

/**
 * Renders an animated, pressable card for a single create option.
 *
 * @param option - The create option data (icon, title, subtitle, route, accentColor) to display in the card
 * @param index - Zero-based index used to stagger the entry animation delay
 * @returns The JSX element for the create option card
 */

function CreateOptionCard({
  option,
  index,
}: {
  option: CreateOption;
  index: number;
}) {
  return (
    // FadeInDown cu delay staggered pe index — animație de intrare
    <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
      <Pressable
        style={({ pressed }) => [
          styles.optionCard,
          pressed && styles.optionCardPressed,
        ]}
        onPress={() => router.push(option.route as any)}
      >
        {/* Icon container colorat */}
        <View
          style={[
            styles.optionIconContainer,
            { backgroundColor: `${option.accentColor}18` },
          ]}
        >
          <Ionicons
            name={option.icon}
            size={28}
            color={option.accentColor}
          />
        </View>

        {/* Text */}
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>{option.title}</Text>
          <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
        </View>

        {/* Săgeată */}
        <Ionicons
          name="chevron-forward"
          size={18}
          color={COLORS.textMuted}
        />
      </Pressable>
    </Animated.View>
  );
}

/**
 * Screen component that presents creation choices and quick navigation actions.
 *
 * Renders an animated header, a list of create-option cards (each navigates to its configured route), a separator row, and two quick-action buttons for inviting friends or joining with a code. The layout respects safe-area insets at the top.
 *
 * @returns A React element rendering the Create hub screen
 */

export default function CreateScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* Header */}
      <Animated.View entering={FadeInUp.duration(400)} style={styles.header}>
        <Text style={styles.headerTitle}>Creează</Text>
        <Text style={styles.headerSubtitle}>
          Ce vrei să faci astăzi?
        </Text>
      </Animated.View>

      {/* Opțiuni */}
      <View style={styles.options}>
        {CREATE_OPTIONS.map((option, index) => (
          <CreateOptionCard key={option.id} option={option} index={index} />
        ))}
      </View>

      {/* Separator */}
      <Animated.View
        entering={FadeInDown.delay(400)}
        style={styles.dividerRow}
      >
        <View style={styles.divider} />
        <Text style={styles.dividerText}>sau continuă rapid</Text>
        <View style={styles.divider} />
      </Animated.View>

      {/* Acțiuni rapide */}
      <Animated.View
        entering={FadeInDown.delay(500)}
        style={styles.quickActions}
      >
        <Pressable
          style={({ pressed }) => [
            styles.quickBtn,
            pressed && { opacity: 0.75 },
          ]}
          onPress={() => router.push("/(modals)/invite-friends" as any)}
        >
          <Ionicons
            name="person-add-outline"
            size={20}
            color={COLORS.accent}
          />
          <Text style={styles.quickBtnText}>Invită prieteni</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.quickBtn,
            pressed && { opacity: 0.75 },
          ]}
          onPress={() =>
            router.push({
              pathname: "/guest/join/[code]",
              params: { code: "" },
            })
          }
        >
          <Ionicons
            name="enter-outline"
            size={20}
            color={COLORS.info}
          />
          <Text style={[styles.quickBtnText, { color: COLORS.info }]}>
            Intră cu cod
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Stiluri ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACING.md,
  },

  // Header
  header: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: COLORS.textMuted,
    fontSize: 15,
    marginTop: SPACING.xs,
  },

  // Opțiuni
  options: {
    gap: SPACING.sm,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
    ...SHADOW.sm,
  },
  optionCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.985 }],
  },
  optionIconContainer: {
    width: 54,
    height: 54,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 3,
  },
  optionSubtitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },

  // Divider
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginVertical: SPACING.xl,
  },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },

  // Quick actions
  quickActions: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  quickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickBtnText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: "700",
  },
});