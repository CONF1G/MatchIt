import { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList,
  Pressable, ActivityIndicator, Alert,
  Share, Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../../services/supabase";
import {
  fetchLobby, fetchLobbyParticipants,
  leaveLobby, startLobby, subscribeToLobby,
} from "../../services/lobby";
import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../config/theme";
import type { Lobby, ParticipantWithProfile } from "../../types/database";

const C = COLORS;

const MODE_LABELS: Record<string, string> = {
  first_match: "First Match",
  deck:        "Full Deck",
  tournament:  "Tournament",
};

export default function LobbyScreen() {
  const insets        = useSafeAreaInsets();
  const { id }        = useLocalSearchParams<{ id: string }>();
  const channelRef    = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const [lobby,         setLobby]         = useState<Lobby | null>(null);
  const [participants,  setParticipants]  = useState<ParticipantWithProfile[]>([]);
  const [presenceGuests, setPresenceGuests] = useState<{ id: string; displayName: string }[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [starting,      setStarting]      = useState(false);
  const [copied,        setCopied]        = useState(false);

  const isHost = lobby?.host_id === currentUserId;

  // ── Load current user ───────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user.id ?? null);
    });
  }, []);

  // ── Load lobby + participants ────────────────────────────────────────────────
  const reload = useCallback(async () => {
    if (!id) return;
    const [lobbyRes, partRes] = await Promise.all([
      fetchLobby(id),
      fetchLobbyParticipants(id),
    ]);
    if (lobbyRes.data) setLobby(lobbyRes.data);
    if (partRes.data)  setParticipants(partRes.data);
    setLoading(false);
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  // ── Realtime subscription (DB changes) ─────────────────────────────────────
  useEffect(() => {
    if (!id) return;

    const ch = subscribeToLobby(
      id,
      () => reload(),
      (status) => {
        if (status === "in_progress") {
          router.replace({ pathname: "/lobby/swipe", params: { matchId: id, mode: lobby?.mode ?? "first_match" } });
        }
        if (status === "cancelled" || status === "finished") {
          Alert.alert("Lobby closed", "The host ended the session.");
          router.replace("/(tabs)/matchLobby");
        }
      },
    );
    channelRef.current = ch;
    return () => { ch.unsubscribe(); };
  }, [id, reload]);

  // ── Presence subscription (guests) ─────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`match-presence:${id}`);
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<any>();
      const guests = (Object.values(state).flat() as any[])
        .filter((m) => m.type === "guest")
        .map((m) => ({ id: m.id as string, displayName: m.displayName as string }));
      setPresenceGuests(guests);
    }).subscribe();
    return () => { ch.unsubscribe(); };
  }, [id]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleCopy = async () => {
    if (!lobby?.invite_code) return;
    if (Platform.OS === "web") {
      await navigator.clipboard.writeText(lobby.invite_code);
    } else {
      await Share.share({ message: lobby.invite_code });
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!lobby?.invite_code) return;
    await Share.share({
      message: `Join my MatchIt lobby! Code: ${lobby.invite_code}`,
    });
  };

  const handleStart = async () => {
    if (!id) return;
    if (participants.filter(p => !p.left_at).length < 1) {
      Alert.alert("Need players", "Wait for at least one other player to join.");
      return;
    }
    setStarting(true);
    const { error } = await startLobby(id);
    if (error) {
      Alert.alert("Error", error);
      setStarting(false);
    }
    // navigation happens via realtime status change
  };

  const handleLeave = () => {
    Alert.alert(
      "Leave lobby?",
      isHost ? "As the host, leaving will cancel the lobby for everyone." : "You will exit this lobby.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave", style: "destructive",
          onPress: async () => {
            channelRef.current?.unsubscribe();
            if (isHost) {
              await supabase.from("lobbies").update({ status: "cancelled" }).eq("id", id);
            } else {
              await leaveLobby(id!);
            }
            router.replace("/(tabs)/matchLobby");
          },
        },
      ]
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  if (!lobby) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={40} color={C.danger} />
        <Text style={styles.errorText}>Lobby not found</Text>
        <Pressable style={styles.backBtn} onPress={() => router.replace("/(tabs)/matchLobby")}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const activeParticipants = participants.filter(p => !p.left_at);
  const totalPlayers = activeParticipants.length + presenceGuests.length;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable onPress={handleLeave} style={styles.leaveBtn}>
          <Ionicons name="exit-outline" size={18} color={C.danger} />
          <Text style={styles.leaveBtnText}>Leave</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {lobby.title ?? MODE_LABELS[lobby.mode] ?? "Lobby"}
          </Text>
          <View style={styles.statusChip}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Waiting</Text>
          </View>
        </View>
        <View style={{ width: 72 }} />
      </View>

      <FlatList
        data={activeParticipants}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            {/* ── Invite code card ── */}
            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>INVITE CODE</Text>
              <Text style={styles.codeValue}>{lobby.invite_code}</Text>
              <View style={styles.codeActions}>
                <Pressable
                  style={({ pressed }) => [styles.codeBtn, pressed && { opacity: 0.7 }]}
                  onPress={handleCopy}
                >
                  <Ionicons name={copied ? "checkmark" : "copy-outline"} size={16} color={copied ? C.success : C.accent} />
                  <Text style={[styles.codeBtnText, copied && { color: C.success }]}>
                    {copied ? "Copied!" : "Copy"}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.codeBtn, pressed && { opacity: 0.7 }]}
                  onPress={handleShare}
                >
                  <Ionicons name="share-outline" size={16} color={C.accent} />
                  <Text style={styles.codeBtnText}>Share</Text>
                </Pressable>
              </View>
            </View>

            {/* ── Mode info ── */}
            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Ionicons name="game-controller-outline" size={13} color={C.accent} />
                <Text style={styles.metaChipText}>{MODE_LABELS[lobby.mode] ?? lobby.mode}</Text>
              </View>
              <View style={styles.metaChip}>
                <Ionicons name="people-outline" size={13} color={C.textMuted} />
                <Text style={[styles.metaChipText, { color: C.textMuted }]}>
                  {totalPlayers} / {lobby.max_players}
                </Text>
              </View>
              {lobby.is_public && (
                <View style={styles.metaChip}>
                  <Ionicons name="globe-outline" size={13} color={C.info} />
                  <Text style={[styles.metaChipText, { color: C.info }]}>Public</Text>
                </View>
              )}
            </View>

            {/* ── Players heading ── */}
            <Text style={styles.sectionLabel}>PLAYERS</Text>
          </>
        }
        renderItem={({ item }) => {
          const profile    = item.profiles as any;
          const name       = profile?.display_name ?? profile?.username ?? "Player";
          const initials   = name.slice(0, 2).toUpperCase();
          const itemIsHost = item.user_id === lobby.host_id;

          return (
            <View style={styles.playerRow}>
              <View style={[styles.avatar, itemIsHost && styles.avatarHost]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{name}</Text>
                {itemIsHost && (
                  <Text style={styles.hostBadge}>Host</Text>
                )}
              </View>
              <View style={[styles.onlineDot, { backgroundColor: C.success }]} />
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={28} color={C.textMuted} />
            <Text style={styles.emptyText}>Waiting for players…</Text>
          </View>
        }
        ListFooterComponent={
          isHost ? (
            <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
              {/* Guest rows */}
              {presenceGuests.map((g) => (
                <View key={g.id} style={styles.playerRow}>
                  <View style={[styles.avatar, { backgroundColor: C.info + "60" }]}>
                    <Text style={styles.avatarText}>{g.displayName.slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={styles.playerInfo}>
                    <Text style={styles.playerName}>{g.displayName}</Text>
                    <Text style={styles.hostBadge}>Guest</Text>
                  </View>
                  <View style={[styles.onlineDot, { backgroundColor: C.success }]} />
                </View>
              ))}

              <Text style={styles.footerHint}>
                Share the code above and start when everyone's in.
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.startBtn,
                  (starting || totalPlayers < 2) && styles.startBtnDisabled,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={handleStart}
                disabled={starting || totalPlayers < 2}
              >
                {starting
                  ? <ActivityIndicator size="small" color={C.textInverse} />
                  : <Ionicons name="play" size={20} color={C.textInverse} />
                }
                <Text style={styles.startBtnText}>
                  {starting ? "Starting…" : "Start Match"}
                </Text>
              </Pressable>
              {totalPlayers < 2 && (
                <Text style={styles.needMoreText}>
                  Need at least 2 players to start
                </Text>
              )}
            </View>
          ) : (
            <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
              <View style={styles.waitingBox}>
                <ActivityIndicator size="small" color={C.accent} />
                <Text style={styles.waitingText}>Waiting for host to start…</Text>
              </View>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", gap: SPACING.md },

  // Header
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  leaveBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               4,
    paddingVertical:   6,
    paddingHorizontal: 10,
    borderRadius:      RADIUS.full,
    backgroundColor:   C.dangerSubtle,
  },
  leaveBtnText: { color: C.danger, fontSize: FONT_SIZE.sm, fontWeight: "700" },
  headerCenter: { alignItems: "center", flex: 1 },
  headerTitle:  { color: C.text, fontSize: FONT_SIZE.lg, fontWeight: "700" },
  statusChip: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    marginTop:         3,
  },
  statusDot: {
    width:           7,
    height:          7,
    borderRadius:    4,
    backgroundColor: C.warning,
  },
  statusText: { color: C.warning, fontSize: FONT_SIZE.xs, fontWeight: "600" },

  // List
  list: { padding: SPACING.lg, gap: SPACING.md },

  // Code card
  codeCard: {
    backgroundColor: C.surface,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     C.borderAccent,
    padding:         SPACING.lg,
    alignItems:      "center",
    gap:             SPACING.sm,
  },
  codeLabel: {
    color:         C.textMuted,
    fontSize:      10,
    fontWeight:    "700",
    letterSpacing: 2,
  },
  codeValue: {
    color:         C.accent,
    fontSize:      40,
    fontWeight:    "900",
    letterSpacing: 8,
  },
  codeActions: {
    flexDirection: "row",
    gap:           SPACING.md,
    marginTop:     SPACING.xs,
  },
  codeBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               6,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.xs + 2,
    borderRadius:      RADIUS.full,
    backgroundColor:   C.accentSubtle,
    borderWidth:       1,
    borderColor:       C.borderAccent,
  },
  codeBtnText: { color: C.accent, fontSize: FONT_SIZE.sm, fontWeight: "700" },

  // Meta chips
  metaRow: { flexDirection: "row", gap: SPACING.sm, flexWrap: "wrap" },
  metaChip: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    backgroundColor:   C.surface,
    borderRadius:      RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       C.border,
  },
  metaChipText: { color: C.accent, fontSize: FONT_SIZE.xs, fontWeight: "600" },

  sectionLabel: {
    color:         C.textMuted,
    fontSize:      10,
    fontWeight:    "700",
    letterSpacing: 1.5,
    marginTop:     SPACING.xs,
  },

  // Player rows
  playerRow: {
    flexDirection:   "row",
    alignItems:      "center",
    backgroundColor: C.surface,
    borderRadius:    RADIUS.md,
    padding:         SPACING.md,
    borderWidth:     1,
    borderColor:     C.border,
    gap:             SPACING.md,
  },
  avatar: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: C.accentDim,
    alignItems:      "center",
    justifyContent:  "center",
  },
  avatarHost: { backgroundColor: C.accent },
  avatarText: { color: C.textInverse, fontSize: FONT_SIZE.sm, fontWeight: "800" },
  playerInfo: { flex: 1 },
  playerName: { color: C.text, fontSize: FONT_SIZE.base, fontWeight: "600" },
  hostBadge:  { color: C.accent, fontSize: FONT_SIZE.xs, fontWeight: "700", marginTop: 1 },
  onlineDot:  { width: 8, height: 8, borderRadius: 4 },

  // Empty state
  emptyBox: {
    alignItems:     "center",
    justifyContent: "center",
    gap:            SPACING.sm,
    paddingVertical: SPACING.xl,
    backgroundColor: C.surface,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     C.border,
    borderStyle:     "dashed",
  },
  emptyText: { color: C.textMuted, fontSize: FONT_SIZE.sm },

  // Footer
  footer: { gap: SPACING.sm, marginTop: SPACING.md },
  footerHint: { color: C.textMuted, fontSize: FONT_SIZE.xs, textAlign: "center" },

  startBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             SPACING.sm,
    backgroundColor: C.accent,
    borderRadius:    RADIUS.lg,
    paddingVertical: SPACING.md + 2,
  },
  startBtnDisabled: { opacity: 0.4 },
  startBtnText: {
    color:      C.textInverse,
    fontSize:   FONT_SIZE.lg,
    fontWeight: "800",
  },
  needMoreText: {
    color:     C.textMuted,
    fontSize:  FONT_SIZE.xs,
    textAlign: "center",
  },

  waitingBox: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             SPACING.sm,
    backgroundColor: C.surface,
    borderRadius:    RADIUS.md,
    paddingVertical: SPACING.md,
    borderWidth:     1,
    borderColor:     C.border,
  },
  waitingText: { color: C.textMuted, fontSize: FONT_SIZE.sm },

  // Error state
  errorText:    { color: C.textMuted, fontSize: FONT_SIZE.base },
  backBtn:      { backgroundColor: C.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderWidth: 1, borderColor: C.border },
  backBtnText:  { color: C.text, fontSize: FONT_SIZE.sm, fontWeight: "600" },
});
