import { useState } from "react";
import {
  View, Text, StyleSheet, Pressable,
  TextInput, Alert, Modal, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../config/theme";
import { supabase } from "../../services/supabase";
import { joinLobby } from "../../services/lobby";
import LogoImg from "../../../assets/logo.png";

const C = COLORS;

export default function MatchLanding() {
  const insets = useSafeAreaInsets();
  const [joinModal,  setJoinModal]  = useState(false);
  const [code,       setCode]       = useState("");
  const [joining,    setJoining]    = useState(false);
  const [joinError,  setJoinError]  = useState<string | null>(null);

  const handleCreate = () => {
    router.push("/(modals)/create-lobby" as any);
  };

  const closeJoinModal = () => {
    setJoinModal(false);
    setCode("");
    setJoinError(null);
  };

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setJoinError("Enter the invite code you received.");
      return;
    }
    setJoining(true);
    setJoinError(null);

    const { data: lobby } = await supabase
      .from("lobbies")
      .select("id, status")
      .eq("invite_code", trimmed)
      .maybeSingle();

    if (!lobby) {
      setJoining(false);
      setJoinError("No active lobby found with that code.");
      return;
    }
    if (lobby.status === "finished" || lobby.status === "cancelled") {
      setJoining(false);
      setJoinError("This lobby has already ended.");
      return;
    }
    if (lobby.status === "in_progress") {
      setJoining(false);
      setJoinError("This match has already started.");
      return;
    }

    const { error: lobbyJoinError } = await joinLobby(lobby.id);
    setJoining(false);

    if (lobbyJoinError) {
      setJoinError(
        lobbyJoinError === "Lobby is full"
          ? "This lobby is full. Try a different code."
          : lobbyJoinError
      );
      return;
    }

    closeJoinModal();
    router.push(`/lobby/${lobby.id}` as any);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* Hero */}
      <Animated.View entering={FadeInUp.duration(500)} style={styles.hero}>
        <Image source={LogoImg} style={styles.logo} contentFit="contain" />
        <Text style={styles.heroTitle}>MatchIt</Text>
        <Text style={styles.heroSubtitle}>
          Swipe together, decide together.
        </Text>
      </Animated.View>

      {/* Action cards */}
      <View style={styles.cards}>
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Pressable style={({ pressed }) => [styles.card, styles.cardCreate, pressed && styles.cardPressed]} onPress={handleCreate}>
            <View style={styles.cardIcon}>
              <Ionicons name="add-circle" size={32} color={C.accent} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Create a Match</Text>
              <Text style={styles.cardDesc}>Pick a catalog, invite friends and start swiping</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.accent} />
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).springify()}>
          <Pressable style={({ pressed }) => [styles.card, styles.cardJoin, pressed && styles.cardPressed]} onPress={() => setJoinModal(true)}>
            <View style={[styles.cardIcon, { backgroundColor: "#5C9EFF18" }]}>
              <Ionicons name="enter" size={32} color="#5C9EFF" />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: "#5C9EFF" }]}>Join a Match</Text>
              <Text style={styles.cardDesc}>Enter an invite code to join a friend's lobby</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#5C9EFF" />
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(260).springify()}>
          <Pressable
            style={({ pressed }) => [styles.card, styles.cardGuest, pressed && styles.cardPressed]}
            onPress={() => router.push({ pathname: "/guest/join/[code]", params: { code: "" } })}
          >
            <View style={[styles.cardIcon, { backgroundColor: "#47FF9C18" }]}>
              <Ionicons name="person-outline" size={28} color="#47FF9C" />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: "#47FF9C" }]}>Join as Guest</Text>
              <Text style={styles.cardDesc}>No account needed — just enter your name and a code</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#47FF9C" />
          </Pressable>
        </Animated.View>
      </View>

      {/* Recent activity hint */}
      <Animated.View entering={FadeInDown.delay(360)} style={styles.hint}>
        <Ionicons name="information-circle-outline" size={14} color={C.textMuted} />
        <Text style={styles.hintText}>
          Matches need at least 2 players. Share your invite code after creating.
        </Text>
      </Animated.View>

      {/* Join Modal */}
      <Modal visible={joinModal} transparent animationType="fade" onRequestClose={closeJoinModal}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeJoinModal} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Enter Invite Code</Text>
            <Text style={styles.modalSubtitle}>Ask the host for the 6-character code</Text>

            <TextInput
              style={[styles.codeInput, joinError ? { borderColor: C.danger } : null]}
              value={code}
              onChangeText={(t) => { setCode(t.toUpperCase()); setJoinError(null); }}
              placeholder="ABC123"
              placeholderTextColor={C.textMuted}
              autoCapitalize="characters"
              maxLength={8}
              autoFocus
              returnKeyType="go"
              onSubmitEditing={handleJoin}
            />

            {joinError && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={14} color={C.danger} />
                <Text style={styles.errorText}>{joinError}</Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={closeJoinModal}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.joinBtn, (!code.trim() || joining) && { opacity: 0.5 }]}
                onPress={handleJoin}
                disabled={!code.trim() || joining}
              >
                <Text style={styles.joinBtnText}>{joining ? "Joining…" : "Join"}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: SPACING.lg },

  hero: {
    alignItems:    "center",
    paddingTop:    SPACING.xxl,
    paddingBottom: SPACING.xl,
    gap:           SPACING.sm,
  },
  logo:          { width: 80, height: 80, marginBottom: SPACING.sm },
  heroTitle:     { color: C.text,     fontSize: 32,           fontWeight: "900", letterSpacing: -0.5 },
  heroSubtitle:  { color: C.textMuted, fontSize: FONT_SIZE.base, textAlign: "center" },

  cards: { gap: SPACING.md },

  card: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             SPACING.md,
    borderRadius:    RADIUS.xl,
    padding:         SPACING.lg,
    borderWidth:     1,
  },
  cardCreate: { backgroundColor: C.accentSubtle, borderColor: C.borderAccent },
  cardJoin:   { backgroundColor: "#5C9EFF12",    borderColor: "#5C9EFF40" },
  cardGuest:  { backgroundColor: "#47FF9C12",    borderColor: "#47FF9C40" },
  cardPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },

  cardIcon: {
    width:           56,
    height:          56,
    borderRadius:    RADIUS.lg,
    backgroundColor: C.accentSubtle,
    alignItems:      "center",
    justifyContent:  "center",
  },
  cardText:  { flex: 1 },
  cardTitle: { color: C.accent,    fontSize: FONT_SIZE.lg,  fontWeight: "800", marginBottom: 3 },
  cardDesc:  { color: C.textMuted, fontSize: FONT_SIZE.sm,  lineHeight: 18 },

  hint: {
    flexDirection:  "row",
    alignItems:     "flex-start",
    gap:            SPACING.xs,
    marginTop:      SPACING.xl,
    paddingHorizontal: SPACING.sm,
  },
  hintText: { color: C.textMuted, fontSize: FONT_SIZE.xs, lineHeight: 16, flex: 1 },

  // Modal
  modalBackdrop: {
    flex:           1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius:  RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    padding:         SPACING.xl,
    paddingBottom:   SPACING.xxl,
    gap:             SPACING.md,
  },
  modalTitle:    { color: C.text,     fontSize: FONT_SIZE.xl,  fontWeight: "800" },
  modalSubtitle: { color: C.textMuted, fontSize: FONT_SIZE.sm },

  codeInput: {
    height:            60,
    backgroundColor:   C.bg,
    borderRadius:      RADIUS.lg,
    borderWidth:       1,
    borderColor:       C.border,
    paddingHorizontal: SPACING.lg,
    color:             C.text,
    fontSize:          28,
    fontWeight:        "800",
    letterSpacing:     6,
    textAlign:         "center",
  },

  modalActions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
  cancelBtn: {
    flex:            1,
    alignItems:      "center",
    justifyContent:  "center",
    paddingVertical: SPACING.md,
    borderRadius:    RADIUS.lg,
    backgroundColor: C.bg,
    borderWidth:     1,
    borderColor:     C.border,
  },
  cancelBtnText: { color: C.textMuted, fontSize: FONT_SIZE.base, fontWeight: "700" },
  joinBtn: {
    flex:            1,
    alignItems:      "center",
    justifyContent:  "center",
    paddingVertical: SPACING.md,
    borderRadius:    RADIUS.lg,
    backgroundColor: "#5C9EFF",
  },
  joinBtnText: { color: "#fff", fontSize: FONT_SIZE.base, fontWeight: "800" },

  errorRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           SPACING.xs,
  },
  errorText: {
    flex:      1,
    color:     C.danger,
    fontSize:  FONT_SIZE.sm,
  },
});
