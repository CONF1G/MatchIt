// src/app/(modals)/create-lobby.tsx
// Modal pentru crearea unui lobby de joc.
// Selectezi catalogul, modul de joc, numărul de jucători și vizibilitatea.

import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  Pressable, Image, Alert, Switch, FlatList,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Input }  from "../../components/common/Input";
import { Button } from "../../components/common/Button";
import { supabase }            from "../../services/supabase";
import { fetchUserCatalogs }   from "../../services/catalog";
import { useAuth }             from "../../hooks/useAuth";
import { Catalog, LobbyMode }  from "../../types/database";
import { LOBBY }               from "../../config/constants";
import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../config/theme";

// ─── Config moduri de joc ─────────────────────────────────────────────────────

const MODES: Array<{ id: LobbyMode; label: string; icon: string; desc: string }> = [
  { id: "first_match",  label: "First Match",  icon: "flash",        desc: "Primul care face match câștigă runda" },
  { id: "deck",         label: "Full Deck",    icon: "layers",       desc: "Jucați toate cardurile din catalog" },
  { id: "tournament",   label: "Tournament",   icon: "trophy",       desc: "Eliminare directă, bracket style" },
];

/**
 * Renders the "Create Lobby" modal allowing a signed-in user to configure and create a new game lobby.
 *
 * The modal lets the user set an optional title, choose a game mode, pick the maximum players (bounded by configured limits),
 * toggle public visibility, and optionally select a catalog. Submitting creates a lobby record, auto-joins the host as a participant,
 * and navigates to the newly created lobby; failures present an alert and abort creation.
 *
 * @returns The React element for the "Create Lobby" modal.
 */

export default function CreateLobbyModal() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [title,       setTitle]       = useState("");
  const [mode,        setMode]        = useState<LobbyMode>("first_match");
  const [maxPlayers,  setMaxPlayers]  = useState<number>(LOBBY.DEFAULT_MAX_PLAYERS);
  const [isPublic,    setIsPublic]    = useState(false);
  const [catalogId,   setCatalogId]   = useState<string | null>(null);
  const [catalogs,    setCatalogs]    = useState<Catalog[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [submitting,  setSubmitting]  = useState(false);

  // Încărcăm cataloagele proprii pentru a putea selecta unul
  useEffect(() => {
    if (!user) return;
    fetchUserCatalogs(user.id, true).then(({ data }) => {
      if (data) setCatalogs(data);
      setLoadingCats(false);
    });
  }, [user]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!user) return;
    setSubmitting(true);

    try {
      const { data, error } = await supabase
        .from("lobbies")
        .insert({
          host_id:     user.id,
          catalog_id:  catalogId,
          title:       title.trim() || null,
          mode,
          max_players: maxPlayers,
          is_public:   isPublic,
          status:      "waiting",
        })
        .select()
        .single();

      if (error) {
        Alert.alert("Eroare", error.message);
        setSubmitting(false);
        return;
      }

      // Auto-join host
      const { error: joinError } = await supabase.from("lobby_participants").insert({ 
        lobby_id: data.id,
        user_id:  user.id,
        role:     "host",
      });
        if (joinError) {  
        // Rollback: delete the lobby since host couldn't join  
        await supabase.from("lobbies").delete().eq("id", data.id);  
        Alert.alert("Eroare", "Nu s-a putut crea lobby-ul");  
        setSubmitting(false);  
        return;  
      } 

      router.replace(`/lobby/${data.id}`);
    } catch (e) {
      Alert.alert("Eroare", e instanceof Error ? e.message : "Eroare necunoscută");
      setSubmitting(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const incrementPlayers = () =>
    setMaxPlayers((v) => Math.min(v + 1, LOBBY.MAX_PLAYERS));
  const decrementPlayers = () =>
    setMaxPlayers((v) => Math.max(v - 1, LOBBY.MIN_PLAYERS));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} disabled={submitting}>
          <Ionicons name="close" size={22} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Lobby Nou</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Titlu opțional ── */}
        <Input
          label="Titlu (opțional)"
          placeholder="Ex: Seara de jocuri 🎮"
          value={title}
          onChangeText={setTitle}
          leftIcon="game-controller-outline"
          maxLength={50}
          containerStyle={styles.field}
        />

        {/* ── Mod de joc ── */}
        <View style={styles.field}>
          <Text style={styles.sectionLabel}>Mod de Joc</Text>
          <View style={styles.modesRow}>
            {MODES.map((m) => (
              <Pressable
                key={m.id}
                style={[styles.modeCard, mode === m.id && styles.modeCardActive]}
                onPress={() => setMode(m.id)}
              >
                <Ionicons
                  name={m.icon as any}
                  size={22}
                  color={mode === m.id ? COLORS.bg : COLORS.textMuted}
                />
                <Text style={[styles.modeLabel, mode === m.id && styles.modeLabelActive]}>
                  {m.label}
                </Text>
                <Text style={[styles.modeDesc, mode === m.id && styles.modeDescActive]}>
                  {m.desc}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Număr jucători ── */}
        <View style={styles.field}>
          <Text style={styles.sectionLabel}>Număr maxim de jucători</Text>
          <View style={styles.stepperRow}>
            <Pressable
              style={[styles.stepperBtn, maxPlayers <= LOBBY.MIN_PLAYERS && styles.stepperBtnDisabled]}
              onPress={decrementPlayers}
              disabled={maxPlayers <= LOBBY.MIN_PLAYERS}
            >
              <Ionicons name="remove" size={20} color={COLORS.text} />
            </Pressable>
            <Text style={styles.stepperValue}>{maxPlayers}</Text>
            <Pressable
              style={[styles.stepperBtn, maxPlayers >= LOBBY.MAX_PLAYERS && styles.stepperBtnDisabled]}
              onPress={incrementPlayers}
              disabled={maxPlayers >= LOBBY.MAX_PLAYERS}
            >
              <Ionicons name="add" size={20} color={COLORS.text} />
            </Pressable>
          </View>
          <Text style={styles.stepperHint}>
            Minim {LOBBY.MIN_PLAYERS} · Maxim {LOBBY.MAX_PLAYERS} jucători
          </Text>
        </View>

        {/* ── Vizibilitate ── */}
        <View style={[styles.field, styles.toggleRow]}>
          <View style={styles.toggleInfo}>
            <Ionicons name="globe-outline" size={18} color={COLORS.textMuted} style={{ marginBottom: 2 }} />
            <Text style={styles.toggleLabel}>Lobby public</Text>
            <Text style={styles.toggleSubtitle}>Oricine poate vedea și intra</Text>
          </View>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ false: COLORS.border, true: COLORS.accent }}
            thumbColor={COLORS.bg}
          />
        </View>

        {/* ── Selectare catalog ── */}
        <View style={styles.field}>
          <Text style={styles.sectionLabel}>Catalog (opțional)</Text>
          <Text style={styles.sectionSubtitle}>
            Alege catalogul cu cardurile care se vor swipe-ui
          </Text>

          {loadingCats ? (
            <View style={styles.catalogsLoading}>
              <Text style={styles.loadingText}>Se încarcă cataloagele...</Text>
            </View>
          ) : catalogs.length === 0 ? (
            <Pressable
              style={styles.noCatalogsBox}
              onPress={() => {
                router.back();
                setTimeout(() => router.push("/(modals)/create-catalog"), 300);
              }}
            >
              <Ionicons name="albums-outline" size={24} color={COLORS.textMuted} />
              <Text style={styles.noCatalogsText}>Nu ai cataloage. Creează unul!</Text>
            </Pressable>
          ) : (
            <FlatList
              data={[{ id: null, title: "Fără catalog", cover_url: null } as any, ...catalogs]}
              keyExtractor={(item) => item.id ?? "none"}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: SPACING.sm, paddingVertical: SPACING.xs }}
              renderItem={({ item }) => {
                const isNone     = item.id === null;
                const isSelected = isNone ? catalogId === null : catalogId === item.id;

                return (
                  <Pressable
                    style={[styles.catalogOption, isSelected && styles.catalogOptionSelected]}
                    onPress={() => setCatalogId(isNone ? null : item.id)}
                  >
                    <View style={styles.catalogOptionImage}>
                      {item.cover_url ? (
                        <Image source={{ uri: item.cover_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      ) : (
                        <Ionicons name={isNone ? "close-circle-outline" : "images-outline"} size={20} color={COLORS.textMuted} />
                      )}
                    </View>
                    <Text style={[styles.catalogOptionTitle, isSelected && styles.catalogOptionTitleSelected]} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.sm }]}>
        <Button
          label={submitting ? "Se creează..." : "Creează Lobby-ul"}
          onPress={handleCreate}
          loading={submitting}
          disabled={submitting}
          fullWidth
          leftIcon={submitting ? undefined : "game-controller"}
        />
      </View>
    </View>
  );
}

// ─── Stiluri ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center",
  },
  headerTitle: { color: COLORS.text, fontSize: FONT_SIZE.lg, fontWeight: "700" },

  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: SPACING.xxl },

  field: {},
  sectionLabel: {
    color: COLORS.textSecondary, fontSize: FONT_SIZE.sm,
    fontWeight: "700", marginBottom: SPACING.sm,
    textTransform: "uppercase", letterSpacing: 0.8,
  },
  sectionSubtitle: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: -SPACING.xs, marginBottom: SPACING.sm },

  // Moduri
  modesRow: { flexDirection: "row", gap: SPACING.sm },
  modeCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border,
    alignItems: "center", gap: 4,
  },
  modeCardActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  modeLabel: { color: COLORS.text, fontSize: FONT_SIZE.xs, fontWeight: "700", textAlign: "center" },
  modeLabelActive: { color: COLORS.bg },
  modeDesc: { color: COLORS.textMuted, fontSize: 9, textAlign: "center", lineHeight: 12 },
  modeDescActive: { color: `${COLORS.bg}99` },

  // Stepper
  stepperRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  stepperBtn: {
    width: 42, height: 42, borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center",
  },
  stepperBtnDisabled: { opacity: 0.35 },
  stepperValue: { color: COLORS.text, fontSize: FONT_SIZE.xxl, fontWeight: "800", minWidth: 40, textAlign: "center" },
  stepperHint: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },

  // Toggle
  toggleRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  toggleInfo: { flex: 1, gap: 2 },
  toggleLabel: { color: COLORS.text, fontSize: FONT_SIZE.base, fontWeight: "600" },
  toggleSubtitle: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },

  // Cataloage
  catalogsLoading: { height: 90, alignItems: "center", justifyContent: "center" },
  loadingText: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  noCatalogsBox: {
    height: 80, borderRadius: RADIUS.md, borderWidth: 1, borderStyle: "dashed",
    borderColor: COLORS.border, backgroundColor: COLORS.surface,
    alignItems: "center", justifyContent: "center", gap: SPACING.xs,
  },
  noCatalogsText: { color: COLORS.accent, fontSize: FONT_SIZE.sm, fontWeight: "600" },
  catalogOption: {
    width: 90, alignItems: "center", gap: SPACING.xs,
    padding: SPACING.xs,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  catalogOptionSelected: { borderColor: COLORS.accent, backgroundColor: COLORS.accentSubtle },
  catalogOptionImage: {
    width: 70, height: 70, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceHigh, alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  catalogOptionTitle: { color: COLORS.textMuted, fontSize: 10, fontWeight: "600", textAlign: "center" },
  catalogOptionTitleSelected: { color: COLORS.accent },

  // Footer
  footer: {
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
});