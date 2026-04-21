import { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList,
  Pressable, ActivityIndicator, Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../../services/supabase";
import { clearGuestSession, type PresenceMember } from "../../services/guest";
import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../config/theme";

const C = COLORS;

type Params = {
  matchId:   string;
  isGuest?:  string;
  guestId?:  string;
  guestName?: string;
};

/**
 * Display the lobby waiting screen and manage realtime presence for a match.
 *
 * Subscribes to Supabase realtime presence for match participants, tracks the
 * current user or guest in presence, navigates to the swipe screen when the
 * host broadcasts a start, and provides a leave flow that unsubscribes and
 * clears guest session when applicable.
 *
 * @returns The rendered React element for the waiting-room UI that shows match info, participants, and controls to leave.
 */
export default function LobbyWaitingScreen() {
  const insets  = useSafeAreaInsets();
  const params  = useLocalSearchParams<Params>();
  const { matchId, isGuest, guestId, guestName } = params;
  const amGuest = isGuest === "1";

  const [match,     setMatch]     = useState<any>(null);
  const [members,   setMembers]   = useState<PresenceMember[]>([]);
  const [loading,   setLoading]   = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Load match metadata ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("id, mode, status, invite_code, host_id")
        .eq("id", matchId)
        .single();
      if (!error && data) setMatch(data);
      setLoading(false);
    })();
  }, [matchId]);

  // ── Realtime Presence ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!matchId) return;

    const channelName = `match-presence:${matchId}`;
    const channel = supabase.channel(channelName);

    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceMember>();
        const all: PresenceMember[] = Object.values(state).flat();
        setMembers(all);
      })
      .on("broadcast", { event: "match_started" }, () => {
        // Host broadcast start → navigate to swipe
        router.replace({
          pathname: "/lobby/swipe",
          params:   { matchId, isGuest: isGuest ?? "0", guestId: guestId ?? "", guestName: guestName ?? "" },
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Track ourselves in presence
          const { data: { user } } = await supabase.auth.getUser();

          await channel.track({
            type:        amGuest ? "guest" : "user",
            id:          amGuest ? (guestId ?? "unknown") : (user?.id ?? "unknown"),
            displayName: amGuest ? (guestName ?? "Guest") : (user?.email?.split("@")[0] ?? "Unknown"),
            isHost:      false,
          } satisfies PresenceMember);
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [matchId, amGuest, guestId, guestName]);

  // ── Leave ──────────────────────────────────────────────────────────────────
  const handleLeave = () => {
    Alert.alert(
      "Leave lobby?",
      "You will exit the session.",
      [
        { text: "Stay",  style: "cancel" },
        {
          text:    "Leave",
          style:   "destructive",
          onPress: async () => {
            channelRef.current?.unsubscribe();
            if (amGuest) await clearGuestSession();
            router.replace(amGuest ? "/guest/join/[code]" : "/(tabs)/matchLobby");
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleLeave} style={styles.leaveBtn}>
          <Ionicons name="exit-outline" size={20} color={C.danger} />
          <Text style={styles.leaveBtnText}>Leave</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Waiting Room</Text>
          <Text style={styles.headerCode}>#{match?.invite_code ?? "..."}</Text>
        </View>
        {/* spacer to balance leave button */}
        <View style={{ width: 72 }} />
      </View>

      {/* Guest badge */}
      {amGuest && (
        <View style={styles.guestBadge}>
          <Ionicons name="person-outline" size={12} color={C.info} />
          <Text style={styles.guestBadgeText}>Joined as guest · {guestName}</Text>
        </View>
      )}

      {/* Pulse animation placeholder */}
      <View style={styles.pulseContainer}>
        <View style={styles.pulseOuter}>
          <View style={styles.pulseInner}>
            <Ionicons name="time-outline" size={28} color={C.accent} />
          </View>
        </View>
        <Text style={styles.waitingTitle}>Waiting for host…</Text>
        <Text style={styles.waitingSubtitle}>
          The match will start when the host is ready.
        </Text>
      </View>

      {/* Participants */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>In lobby</Text>
          <Text style={styles.memberCount}>{members.length}</Text>
        </View>

        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.memberRow}>
              <View style={[styles.avatar, item.type === "guest" && styles.avatarGuest]}>
                <Text style={styles.avatarText}>
                  {item.displayName.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{item.displayName}</Text>
                {item.type === "guest" && (
                  <Text style={styles.memberType}>Guest</Text>
                )}
              </View>
              <View style={[styles.statusDot, { backgroundColor: C.success }]} />
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Connecting…</Text>
          }
        />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: C.bg },
  center:  { flex: 1, alignItems: "center", justifyContent: "center" },

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
    flexDirection: "row",
    alignItems:    "center",
    gap:           4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius:  RADIUS.full,
    backgroundColor: C.dangerSubtle,
  },
  leaveBtnText: { color: C.danger, fontSize: FONT_SIZE.sm, fontWeight: "700" },
  headerCenter:  { alignItems: "center" },
  headerTitle:   { color: C.text, fontSize: FONT_SIZE.lg, fontWeight: "700" },
  headerCode:    { color: C.textMuted, fontSize: FONT_SIZE.xs, letterSpacing: 1.5, marginTop: 1 },

  guestBadge: {
    flexDirection:    "row",
    alignItems:       "center",
    alignSelf:        "center",
    gap:              SPACING.xs,
    backgroundColor:  C.infoSubtle,
    borderRadius:     RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical:  4,
    marginTop:        SPACING.md,
    borderWidth:      1,
    borderColor:      C.info + "40",
  },
  guestBadgeText: { color: C.info, fontSize: FONT_SIZE.xs, fontWeight: "600" },

  pulseContainer: {
    alignItems: "center",
    paddingVertical: SPACING.xxl,
    gap: SPACING.sm,
  },
  pulseOuter: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: C.accentSubtle,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    SPACING.sm,
  },
  pulseInner: {
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: C.surface,
    borderWidth:     1,
    borderColor:     C.borderAccent,
    alignItems:      "center",
    justifyContent:  "center",
  },
  waitingTitle: {
    color:      C.text,
    fontSize:   FONT_SIZE.xl,
    fontWeight: "700",
  },
  waitingSubtitle: {
    color:     C.textMuted,
    fontSize:  FONT_SIZE.sm,
    textAlign: "center",
  },

  section: {
    paddingHorizontal: SPACING.lg,
    flex: 1,
  },
  sectionHeader: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    marginBottom:   SPACING.md,
  },
  sectionTitle: {
    color:         C.text,
    fontSize:      FONT_SIZE.xs,
    fontWeight:    "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  memberCount: {
    color:      C.accent,
    fontSize:   FONT_SIZE.sm,
    fontWeight: "800",
  },

  memberRow: {
    flexDirection:   "row",
    alignItems:      "center",
    backgroundColor: C.surface,
    borderRadius:    RADIUS.md,
    padding:         SPACING.sm + 4,
    marginBottom:    SPACING.sm,
    borderWidth:     1,
    borderColor:     C.border,
  },
  avatar: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: C.accentDim,
    alignItems:      "center",
    justifyContent:  "center",
  },
  avatarGuest: { backgroundColor: C.info + "60" },
  avatarText:  { color: C.bg, fontSize: FONT_SIZE.sm, fontWeight: "800" },
  memberInfo:  { flex: 1, marginLeft: SPACING.sm },
  memberName:  { color: C.text, fontSize: FONT_SIZE.base, fontWeight: "600" },
  memberType:  { color: C.info, fontSize: FONT_SIZE.xs, fontWeight: "600", marginTop: 1 },
  statusDot:   { width: 8, height: 8, borderRadius: 4 },
  emptyText:   { color: C.textMuted, fontSize: FONT_SIZE.sm, textAlign: "center", paddingVertical: SPACING.md },
});
