import { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, Pressable,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, TextInput,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getLobbyByCode,
  saveGuestSession,
} from "../../../services/guest";
import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../../config/theme";

const C = COLORS;

const MODE_LABELS: Record<string, string> = {
  first_match: "First Match",
  deck:        "Full Deck",
  tournament:  "Tournament",
};

/**
 * Screen for joining a lobby as a guest using an invite code and a display name.
 *
 * Provides a two-step flow: lookup a lobby by invite code (auto-triggered if a `code` URL param is present and valid), then enter a display name to create a guest session and navigate to the lobby waiting screen.
 *
 * - Validates invite codes (minimum length 4) and shows lookup state/errors.
 * - Shows a lobby preview when found and focuses the name input.
 * - Validates display name (minimum 2 characters), generates a guest ID, saves the guest session, and navigates to `/lobby/waiting` with `matchId`, `guestId`, `guestName`, and `isGuest="1"`.
 *
 * @returns The GuestJoinScreen React element.
 */
export default function GuestJoinScreen() {
  const insets = useSafeAreaInsets();
  const { code: codeParam } = useLocalSearchParams<{ code?: string }>();

  const [code,        setCode]        = useState(codeParam ?? "");
  const [displayName, setDisplayName] = useState("");
  const [lobby,       setLobby]       = useState<any>(null);
  const [lookingUp,   setLookingUp]   = useState(false);
  const [joining,     setJoining]     = useState(false);
  const [codeError,   setCodeError]   = useState<string | null>(null);
  const [nameError,   setNameError]   = useState<string | null>(null);

  const nameInputRef = useRef<TextInput>(null);

  // Auto-lookup when a code arrives from URL params
  useEffect(() => {
    if (codeParam && codeParam.length >= 4) {
      handleLookup(codeParam);
    }
  }, [codeParam]);

  const handleLookup = async (value?: string) => {
    const lookupCode = (value ?? code).trim().toUpperCase();
    if (lookupCode.length < 4) {
      setCodeError("Enter a valid invite code");
      return;
    }

    setLookingUp(true);
    setCodeError(null);
    setLobby(null);

    const { data, error } = await getLobbyByCode(lookupCode);

    setLookingUp(false);

    if (error || !data) {
      setCodeError(error ?? "Lobby not found");
      return;
    }

    setLobby(data);
    setTimeout(() => nameInputRef.current?.focus(), 150);
  };

  const handleJoin = async () => {
    const trimmedName = displayName.trim();
    if (trimmedName.length < 2) {
      setNameError("Enter at least 2 characters");
      return;
    }

    setNameError(null);
    setJoining(true);

    const guestId = Math.random().toString(36).substring(2, 10);

    await saveGuestSession({
      guestId,
      displayName: trimmedName,
      matchId:     lobby.id,
      inviteCode:  lobby.invite_code,
    });

    router.replace({
      pathname: "/lobby/waiting",
      params:   {
        matchId:     lobby.id,
        guestId,
        guestName:   trimmedName,
        isGuest:     "1",
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + SPACING.xl, paddingBottom: insets.bottom + SPACING.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconBox}>
            <Ionicons name="enter-outline" size={30} color={C.accent} />
          </View>
          <Text style={styles.title}>Join as Guest</Text>
          <Text style={styles.subtitle}>
            No account needed — just enter the invite code and your name.
          </Text>
        </View>

        {/* ── Step 1: Code ── */}
        <View style={styles.section}>
          <Text style={styles.label}>Invite Code</Text>
          <View style={styles.codeRow}>
            <TextInput
              style={[styles.codeInput, codeError ? styles.inputError : lobby ? styles.inputSuccess : null]}
              value={code}
              onChangeText={(t) => {
                setCode(t.toUpperCase());
                setCodeError(null);
                setLobby(null);
              }}
              placeholder="ABC123"
              placeholderTextColor={C.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              returnKeyType="search"
              onSubmitEditing={() => handleLookup()}
            />
            <Pressable
              style={[styles.lookupBtn, lookingUp && { opacity: 0.6 }]}
              onPress={() => handleLookup()}
              disabled={lookingUp}
            >
              {lookingUp
                ? <ActivityIndicator size="small" color={C.bg} />
                : <Ionicons name="search" size={18} color={C.bg} />
              }
            </Pressable>
          </View>

          {codeError && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={14} color={C.danger} />
              <Text style={styles.errorText}>{codeError}</Text>
            </View>
          )}

          {/* Lobby preview card */}
          {lobby && (
            <View style={styles.lobbyCard}>
              <View style={styles.lobbyCardRow}>
                <Ionicons name="checkmark-circle" size={18} color={C.success} />
                <Text style={styles.lobbyFound}>Lobby found!</Text>
              </View>
              <View style={styles.lobbyMeta}>
                <View style={styles.metaChip}>
                  <Ionicons name="game-controller-outline" size={12} color={C.accent} />
                  <Text style={styles.metaChipText}>{MODE_LABELS[lobby.mode] ?? lobby.mode}</Text>
                </View>
                <View style={[styles.metaChip, { backgroundColor: C.successSubtle }]}>
                  <Ionicons name="radio-button-on" size={10} color={C.success} />
                  <Text style={[styles.metaChipText, { color: C.success }]}>
                    {lobby.status === "waiting" ? "Waiting to start" : "In progress"}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ── Step 2: Name (shown once lobby is found) ── */}
        {lobby && (
          <View style={styles.section}>
            <Text style={styles.label}>Your Display Name</Text>
            <TextInput
              ref={nameInputRef}
              style={[styles.nameInput, nameError ? styles.inputError : null]}
              value={displayName}
              onChangeText={(t) => { setDisplayName(t); setNameError(null); }}
              placeholder="Enter your name"
              placeholderTextColor={C.textMuted}
              autoCorrect={false}
              maxLength={30}
              returnKeyType="go"
              onSubmitEditing={handleJoin}
            />
            {nameError && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={14} color={C.danger} />
                <Text style={styles.errorText}>{nameError}</Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.joinBtn,
                (!displayName.trim() || joining) && styles.joinBtnDisabled,
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleJoin}
              disabled={!displayName.trim() || joining}
            >
              {joining
                ? <ActivityIndicator size="small" color={C.bg} />
                : <>
                    <Ionicons name="enter-outline" size={18} color={C.bg} />
                    <Text style={styles.joinBtnText}>Join as Guest</Text>
                  </>
              }
            </Pressable>
          </View>
        )}

        {/* Footer — login prompt */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Have an account? </Text>
          <Pressable onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.footerLink}>Sign in instead</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexGrow:          1,
    paddingHorizontal: SPACING.lg,
    gap:               SPACING.xl,
  },

  header: {
    alignItems: "center",
    gap:        SPACING.sm,
  },
  iconBox: {
    width:           64,
    height:          64,
    borderRadius:    RADIUS.xl,
    backgroundColor: C.accentSubtle,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    SPACING.xs,
  },
  title: {
    color:      C.text,
    fontSize:   FONT_SIZE.xxxl,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color:     C.textMuted,
    fontSize:  FONT_SIZE.sm,
    textAlign: "center",
    lineHeight: 20,
  },

  section: { gap: SPACING.sm },

  label: {
    color:      C.textSecondary,
    fontSize:   FONT_SIZE.sm,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },

  // Code row
  codeRow: {
    flexDirection: "row",
    gap:           SPACING.sm,
  },
  codeInput: {
    flex:            1,
    height:          52,
    backgroundColor: C.surface,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     C.border,
    paddingHorizontal: SPACING.md,
    color:           C.text,
    fontSize:        FONT_SIZE.xl,
    fontWeight:      "800",
    letterSpacing:   4,
    textAlign:       "center",
  },
  lookupBtn: {
    width:           52,
    height:          52,
    borderRadius:    RADIUS.md,
    backgroundColor: C.accent,
    alignItems:      "center",
    justifyContent:  "center",
  },

  // Name input
  nameInput: {
    height:          52,
    backgroundColor: C.surface,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     C.border,
    paddingHorizontal: SPACING.md,
    color:           C.text,
    fontSize:        FONT_SIZE.base,
  },

  inputError:   { borderColor: C.danger },
  inputSuccess: { borderColor: C.success },

  errorRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           SPACING.xs,
  },
  errorText: {
    color:    C.danger,
    fontSize: FONT_SIZE.sm,
  },

  // Lobby card
  lobbyCard: {
    backgroundColor: C.successSubtle,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     C.success + "40",
    padding:         SPACING.md,
    gap:             SPACING.sm,
  },
  lobbyCardRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           SPACING.xs,
  },
  lobbyFound: {
    color:      C.success,
    fontSize:   FONT_SIZE.base,
    fontWeight: "700",
  },
  lobbyMeta: {
    flexDirection: "row",
    gap:           SPACING.sm,
  },
  metaChip: {
    flexDirection:    "row",
    alignItems:       "center",
    gap:              4,
    backgroundColor:  C.accentSubtle,
    borderRadius:     RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical:  4,
  },
  metaChipText: {
    color:      C.accent,
    fontSize:   FONT_SIZE.xs,
    fontWeight: "600",
  },

  // Join button
  joinBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             SPACING.sm,
    backgroundColor: C.accent,
    borderRadius:    RADIUS.md,
    paddingVertical: SPACING.md,
    marginTop:       SPACING.xs,
  },
  joinBtnDisabled: { opacity: 0.45 },
  joinBtnText: {
    color:      C.bg,
    fontSize:   FONT_SIZE.lg,
    fontWeight: "800",
  },

  // Footer
  footer: {
    flexDirection:  "row",
    justifyContent: "center",
    marginTop:      SPACING.md,
  },
  footerText: { color: C.textMuted, fontSize: FONT_SIZE.sm },
  footerLink: { color: C.accent,   fontSize: FONT_SIZE.sm, fontWeight: "700" },
});
