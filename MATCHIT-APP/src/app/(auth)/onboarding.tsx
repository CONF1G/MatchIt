// src/app/(auth)/onboarding.tsx
// Ecranul de onboarding după prima înregistrare.
// Utilizatorul selectează categoriile preferate → salvate în profiles.interests
// Conform diagramei secvențiale din PRD: PATCH /profiles?id=eq.{user_id} { interests: [...] }

import { useState } from "react";
import {
  View, Text, StyleSheet, Pressable,
  ScrollView, Alert,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth }  from "../../hooks/useAuth";
import { Button }   from "../../components/common/Button";
import { supabase } from "../../services/supabase";
import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../config/theme";

// ─── Categorii disponibile ────────────────────────────────────────────────────

type Category = {
  id:    string;
  label: string;
  icon:  keyof typeof Ionicons.glyphMap;
  color: string;
};

const CATEGORIES: Category[] = [
  { id: "travel",       label: "Călătorii",      icon: "airplane",       color: "#5C9EFF" },
  { id: "food",         label: "Mâncare",         icon: "restaurant",     color: "#FFB347" },
  { id: "fashion",      label: "Modă",            icon: "shirt",          color: "#FF69B4" },
  { id: "interior",     label: "Design Interior", icon: "home",           color: "#9B59B6" },
  { id: "architecture", label: "Arhitectură",     icon: "business",       color: "#E8FF47" },
  { id: "nature",       label: "Natură",          icon: "leaf",           color: "#47FF9C" },
  { id: "art",          label: "Artă",            icon: "color-palette",  color: "#FF5C5C" },
  { id: "sport",        label: "Sport",           icon: "fitness",        color: "#FF8C00" },
  { id: "music",        label: "Muzică",          icon: "musical-notes",  color: "#DA70D6" },
  { id: "tech",         label: "Tehnologie",      icon: "hardware-chip",  color: "#00BFFF" },
  { id: "movies",       label: "Filme",           icon: "film",           color: "#FF6347" },
  { id: "books",        label: "Cărți",           icon: "book",           color: "#98FB98" },
];

// ─── Card categorie ───────────────────────────────────────────────────────────

function CategoryCard({
  category, selected, onPress,
}: { category: Category; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.categoryCard,
        selected && { borderColor: category.color, backgroundColor: `${category.color}15` },
        pressed && { opacity: 0.8 },
      ]}
      onPress={onPress}
    >
      {/* Checkmark dacă selectat */}
      {selected && (
        <View style={[styles.checkmark, { backgroundColor: category.color }]}>
          <Ionicons name="checkmark" size={10} color={COLORS.bg} />
        </View>
      )}

      <View style={[styles.categoryIcon, { backgroundColor: `${category.color}20` }]}>
        <Ionicons name={category.icon} size={22} color={category.color} />
      </View>
      <Text
        style={[styles.categoryLabel, selected && { color: category.color, fontWeight: "700" }]}
        numberOfLines={2}
      >
        {category.label}
      </Text>
    </Pressable>
  );
}

// ─── Ecran ────────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { refreshProfile } = useAuth();

  const [selected,  setSelected]  = useState<string[]>([]);
  const [saving,    setSaving]     = useState(false);

  const toggleCategory = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const save = async (interests: string[]) => {
    setSaving(true);
    // Get session directly — hook state may not be set yet right after registration
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setSaving(false);
      Alert.alert("Eroare", "Sesiunea a expirat. Te rugăm să te autentifici din nou.", [
        { text: "OK", onPress: () => router.replace("/(auth)/login") },
      ]);
      return false;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ interests, onboarding_completed: true })
      .eq("id", session.user.id);

    setSaving(false);
    if (error) {
      Alert.alert("Eroare", error.message);
      return false;
    }
    await refreshProfile();
    return true;
  };

  const handleContinue = async () => {
    const ok = await save(selected);
    if (ok) router.replace("/(tabs)");
  };

  const handleSkip = async () => {
    await save([]);
    router.replace("/(tabs)");
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Ce te interesează?</Text>
          <Text style={styles.subtitle}>
            Alegem cataloage relevante pentru tine.{"\n"}
            Selectează minim 3 categorii.
          </Text>
        </View>
        <Pressable onPress={handleSkip} style={styles.skipBtn}>
          <Text style={styles.skipText}>Sari</Text>
        </Pressable>
      </View>

      {/* Counter */}
      <View style={styles.counterRow}>
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {selected.length} selectate
          </Text>
        </View>
      </View>

      {/* Grid categorii */}
      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {CATEGORIES.map((cat) => (
          <CategoryCard
            key={cat.id}
            category={cat}
            selected={selected.includes(cat.id)}
            onPress={() => toggleCategory(cat.id)}
          />
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <Button
          label={saving ? "Se salvează..." : "Continuă"}
          onPress={handleContinue}
          loading={saving}
          disabled={selected.length < 1 || saving}
          fullWidth
          rightIcon="arrow-forward"
        />
        {selected.length < 3 && selected.length > 0 && (
          <Text style={styles.minHint}>
            Mai selectează {3 - selected.length} categori{3 - selected.length === 1 ? "e" : "i"}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Stiluri ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: COLORS.bg,
  },

  header: {
    flexDirection:     "row",
    justifyContent:    "space-between",
    alignItems:        "flex-start",
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.lg,
  },
  title: {
    color:      COLORS.text,
    fontSize:   FONT_SIZE.xxl,
    fontWeight: "800",
  },
  subtitle: {
    color:      COLORS.textMuted,
    fontSize:   FONT_SIZE.sm,
    lineHeight: 18,
    marginTop:  SPACING.xs,
  },
  skipBtn: { paddingTop: SPACING.xs },
  skipText: {
    color:      COLORS.textMuted,
    fontSize:   FONT_SIZE.base,
    fontWeight: "600",
  },

  counterRow: {
    paddingHorizontal: SPACING.lg,
    marginBottom:      SPACING.sm,
  },
  counter: {
    alignSelf:       "flex-start",
    backgroundColor: COLORS.accentSubtle,
    borderRadius:    RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       COLORS.borderAccent,
  },
  counterText: {
    color:      COLORS.accent,
    fontSize:   FONT_SIZE.xs,
    fontWeight: "700",
  },

  // Grid 3 coloane
  grid: {
    flexDirection:     "row",
    flexWrap:          "wrap",
    paddingHorizontal: SPACING.md,
    gap:               SPACING.sm,
    paddingBottom:     SPACING.xl,
  },
  categoryCard: {
    width:           "31%",
    aspectRatio:     1,
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     COLORS.border,
    alignItems:      "center",
    justifyContent:  "center",
    gap:             SPACING.xs,
    padding:         SPACING.sm,
    position:        "relative",
  },
  checkmark: {
    position:     "absolute",
    top:          6,
    right:        6,
    width:        18,
    height:       18,
    borderRadius: RADIUS.full,
    alignItems:   "center",
    justifyContent: "center",
  },
  categoryIcon: {
    width:          44,
    height:         44,
    borderRadius:   RADIUS.md,
    alignItems:     "center",
    justifyContent: "center",
  },
  categoryLabel: {
    color:     COLORS.textSecondary,
    fontSize:  FONT_SIZE.xs,
    textAlign: "center",
    lineHeight: 14,
  },

  // Footer
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop:        SPACING.md,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    COLORS.border,
    gap:               SPACING.sm,
  },
  minHint: {
    color:     COLORS.textMuted,
    fontSize:  FONT_SIZE.xs,
    textAlign: "center",
  },
});