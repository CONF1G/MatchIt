// src/screens/MatchLobby.js
import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  createMatch,
  joinMatch,
  fetchMatchPlayers,
  subscribeToMatchPlayers,
  supabase,
} from "../../services/supabase";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#0D0D0D",
  surface: "#1A1A1A",
  surfaceHigh: "#242424",
  accent: "#E8FF47",
  accentDim: "#B8CC38",
  text: "#F0F0F0",
  textMuted: "#888",
  border: "#2A2A2A",
  danger: "#FF5C5C",
  success: "#47FF9C",
};

const MATCH_MODES = [
  { id: "first_match", label: "First Match", icon: "flash", description: "First to clear wins" },
  { id: "deck", label: "Full Deck", icon: "layers", description: "Play all cards in deck" },
  { id: "tournament", label: "Tournament", icon: "trophy", description: "Bracket elimination" },
];

/**
 * Renders a player row with avatar, display name, optional host badge/label, and a fixed status dot, animating its entrance.
 *
 * @param player - Player data object (expected to include `profiles.username` for display; falls back to a placeholder if missing)
 * @param isHost - Whether to show host-specific UI (badge and "HOST" label)
 * @param index - Zero-based index used to stagger the entrance animation
 * @returns The rendered player row React element
 */

function PlayerRow({ player, isHost, index }) {
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(20))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, delay: index * 60, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const username = player?.profiles?.username ?? "Anonymous";
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <Animated.View style={[styles.playerRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
        {isHost && <View style={styles.hostBadge} />}
      </View>

      {/* Info */}
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{username}</Text>
        {isHost && <Text style={styles.hostLabel}>HOST</Text>}
      </View>

      {/* Status dot */}
      <View style={[styles.statusDot, { backgroundColor: C.success }]} />
    </Animated.View>
  );
}

/**
 * Renders a selectable match mode card showing an icon, label, and description.
 *
 * The visual appearance changes when selected; tapping the card invokes the provided handler.
 *
 * @param mode - Mode metadata containing at least `icon`, `label`, and `description`
 * @param onPress - Callback invoked when the card is pressed
 * @returns The rendered mode card element
 */
function ModeCard({ mode, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.modeCard, selected && styles.modeCardSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={mode.icon}
        size={20}
        color={selected ? C.bg : C.textMuted}
        style={{ marginBottom: 6 }}
      />
      <Text style={[styles.modeLabel, selected && styles.modeLabelSelected]}>{mode.label}</Text>
      <Text style={[styles.modeDesc, selected && styles.modeDescSelected]}>{mode.description}</Text>
    </TouchableOpacity>
  );
}

/**
 * Render the Match Lobby screen that displays the current lobby, players, match mode selector, and host controls.
 *
 * Initializes or joins a match, subscribes to realtime player updates, and provides actions to invite players and start the match.
 *
 * @param navigation - Navigation object used to go back or replace the screen with the match interface
 * @param route - Route object; may contain `params.matchId` to join an existing lobby
 * @returns The rendered Match Lobby React element
 */

export default function MatchLobby({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const existingMatchId = route?.params?.matchId ?? null;

  const [match, setMatch] = useState(null);
  const [players, setPlayers] = useState([]);
  const [selectedMode, setSelectedMode] = useState("first_match");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id);

      let matchData;
      if (existingMatchId) {
        // Join an existing lobby via invite link
        await joinMatch(existingMatchId);
        const { data } = await supabase
          .from("matches")
          .select("*")
          .eq("id", existingMatchId)
          .single();
        matchData = data;
        setSelectedMode(data?.mode ?? "first_match");
      } else {
        // Create a brand new lobby
        matchData = await createMatch(selectedMode);
      }

      setMatch(matchData);
      const initialPlayers = await fetchMatchPlayers(matchData.id);
      setPlayers(initialPlayers);
      setLoading(false);
    })();
  }, []);

  // ── Realtime subscription ───────────────────────────────────────────────────
  useEffect(() => {
    if (!match) return;

    const channel = subscribeToMatchPlayers(match.id, async () => {
      const updated = await fetchMatchPlayers(match.id);
      setPlayers(updated);
    });

    return () => { channel.unsubscribe(); };
  }, [match]);

  // ── Invite link ─────────────────────────────────────────────────────────────
  const handleInvite = useCallback(async () => {
    if (!match) return;
    try {
      await Share.share({
        message: `Join my CardGame lobby! Code: ${match.invite_code}\nhttps://cardgame.app/lobby/${match.id}`,
        title: "Invite to match",
      });
    } catch {
      Alert.alert("Share failed", "Could not open share sheet.");
    }
  }, [match]);

  // ── Start match ─────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (!match) return;
    setStarting(true);
    try {
      await supabase
        .from("matches")
        .update({ status: "in_progress", mode: selectedMode })
        .eq("id", match.id);

      navigation.replace("MatchInterface", { matchId: match.id, mode: selectedMode });
    } catch (e) {
      Alert.alert("Error", e.message);
      setStarting(false);
    }
  }, [match, selectedMode]);

  const isHost = match?.host_id === currentUserId;

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>Creating lobby…</Text>
      </View>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Match Lobby</Text>
          <Text style={styles.headerCode}>#{match?.invite_code}</Text>
        </View>
        <TouchableOpacity onPress={handleInvite} style={styles.inviteBtn}>
          <Ionicons name="person-add-outline" size={18} color={C.accent} />
          <Text style={styles.inviteBtnText}>Invite</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={[]}
        keyExtractor={() => "static"}
        renderItem={null}
        ListHeaderComponent={
          <>
            {/* Players Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Players</Text>
                <Text style={styles.playerCount}>
                  {players.length}
                  <Text style={styles.textMuted}>/8</Text>
                </Text>
              </View>

              {players.map((p, i) => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  isHost={p.user_id === match?.host_id}
                  index={i}
                />
              ))}

              {/* Empty slots */}
              {Array.from({ length: Math.max(0, 3 - players.length) }).map((_, i) => (
                <View key={`empty-${i}`} style={[styles.playerRow, styles.playerRowEmpty]}>
                  <View style={[styles.avatar, styles.avatarEmpty]}>
                    <Ionicons name="person-outline" size={16} color={C.border} />
                  </View>
                  <Text style={styles.emptySlot}>Waiting for player…</Text>
                </View>
              ))}
            </View>

            {/* Match Mode */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Match Mode</Text>
              <View style={styles.modeRow}>
                {MATCH_MODES.map((mode) => (
                  <ModeCard
                    key={mode.id}
                    mode={mode}
                    selected={selectedMode === mode.id}
                    onPress={() => isHost && setSelectedMode(mode.id)}
                  />
                ))}
              </View>
              {!isHost && (
                <Text style={styles.hostOnly}>Only the host can change the mode</Text>
              )}
            </View>
          </>
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      />

      {/* Bottom CTA */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        {isHost ? (
          <TouchableOpacity
            style={[styles.startBtn, players.length < 2 && styles.startBtnDisabled]}
            onPress={handleStart}
            disabled={players.length < 2 || starting}
            activeOpacity={0.85}
          >
            {starting ? (
              <ActivityIndicator size="small" color={C.bg} />
            ) : (
              <>
                <Ionicons name="play" size={18} color={C.bg} />
                <Text style={styles.startBtnText}>
                  {players.length < 2 ? "Need 2+ players" : "Start Match"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.waitingBanner}>
            <Ionicons name="time-outline" size={18} color={C.accentDim} />
            <Text style={styles.waitingText}>Waiting for host to start…</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: C.textMuted, fontFamily: "monospace" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: "700", letterSpacing: 0.3 },
  headerCode: { color: C.textMuted, fontSize: 11, fontWeight: "600", letterSpacing: 1.5, marginTop: 1 },
  inviteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  inviteBtnText: { color: C.accent, fontSize: 13, fontWeight: "700" },

  // Section
  section: { paddingHorizontal: 20, paddingTop: 28 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle: { color: C.text, fontSize: 13, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  playerCount: { color: C.accent, fontSize: 14, fontWeight: "800" },
  textMuted: { color: C.textMuted },

  // Player row
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  playerRowEmpty: { opacity: 0.35 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.accentDim,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  avatarEmpty: { backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border, borderStyle: "dashed" },
  avatarText: { color: C.bg, fontSize: 14, fontWeight: "800" },
  hostBadge: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.accent,
    borderWidth: 2,
    borderColor: C.surface,
  },
  playerInfo: { flex: 1, marginLeft: 12 },
  playerName: { color: C.text, fontSize: 15, fontWeight: "600" },
  hostLabel: { color: C.accentDim, fontSize: 10, fontWeight: "700", letterSpacing: 1.2, marginTop: 2 },
  emptySlot: { color: C.textMuted, fontSize: 14, marginLeft: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  // Mode cards
  modeRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  modeCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
  },
  modeCardSelected: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  modeLabel: { color: C.text, fontSize: 12, fontWeight: "700", textAlign: "center", marginBottom: 2 },
  modeLabelSelected: { color: C.bg },
  modeDesc: { color: C.textMuted, fontSize: 10, textAlign: "center", lineHeight: 13 },
  modeDescSelected: { color: "#00000099" },
  hostOnly: { color: C.textMuted, fontSize: 11, marginTop: 10, textAlign: "center" },

  // Bottom bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  startBtn: {
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  startBtnDisabled: { opacity: 0.4 },
  startBtnText: { color: C.bg, fontSize: 16, fontWeight: "800", letterSpacing: 0.4 },
  waitingBanner: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  waitingText: { color: C.accentDim, fontSize: 14, fontWeight: "600" },
});