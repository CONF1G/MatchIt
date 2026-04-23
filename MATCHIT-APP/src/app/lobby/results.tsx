import { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList,
  Pressable, ActivityIndicator, Animated,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../../services/supabase";
import { clearGuestSession } from "../../services/guest";
import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../config/theme";

const C = COLORS;

type Params = {
  matchId:          string;
  mode?:            string;
  isGuest?:         string;
  guestId?:         string;
  guestName?:       string;
  winnerPhotoId?:   string;
  winnerPhotoUrl?:  string;
  winnerPhotoTitle?: string;
};

type MatchedPhoto = {
  id:        string;
  url: string;
  title?:    string | null;
  likedBy:   string[];
};

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Params>();
  const { matchId, isGuest, guestId, guestName, winnerPhotoUrl, winnerPhotoTitle } = params;
  const amGuest = isGuest === "1";

  const [matches,  setMatches]  = useState<MatchedPhoto[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [players,  setPlayers]  = useState<{ id: string; displayName: string }[]>([]);

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1, duration: 600, delay: 200, useNativeDriver: true,
    }).start();
  }, []);

  // ── Load match results from broadcast log (via Supabase channel history) ──
  // Since we store liked-photo state in memory during the swipe session,
  // here we just re-subscribe to the channel for a moment to collect any
  // match_found events that were broadcast, then load the photos from DB.
  useEffect(() => {
    if (!matchId) return;

    (async () => {
      try {
        // Fetch presence state to get player list
        const channel = supabase.channel(`match-presence:${matchId}`);

        let resolved = false;
        const timeout = setTimeout(async () => {
          if (!resolved) {
            resolved = true;
            channel.unsubscribe();
            await loadMatchData();
          }
        }, 3000);

        const collectedMatches: MatchedPhoto[] = [];

        channel
          .on("presence", { event: "sync" }, () => {
            const state = channel.presenceState<{ id: string; displayName: string }>();
            const all = Object.values(state).flat();
            setPlayers(all.map((p) => ({ id: p.id, displayName: p.displayName })));
          })
          .on("broadcast", { event: "match_found" }, ({ payload }) => {
            const exists = collectedMatches.some((m) => m.id === payload.photoId);
            if (!exists) {
              collectedMatches.push({
                id:       payload.photoId,
                url: payload.imageUrl,
                title:    payload.title ?? null,
                likedBy:  payload.matchedBy ?? [],
              });
            }
          })
          .subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
              const { data: { session } } = await supabase.auth.getSession();
              await channel.track({
                type:        amGuest ? "guest" : "user",
                id:          amGuest ? (guestId ?? "guest") : (session?.user.id ?? "anon"),
                displayName: amGuest ? (guestName ?? "Guest") : (session?.user.email?.split("@")[0] ?? "Unknown"),
                isHost:      false,
              });

              // Wait briefly for any late broadcasts
              setTimeout(async () => {
                if (!resolved) {
                  resolved = true;
                  clearTimeout(timeout);
                  channel.unsubscribe();
                  if (collectedMatches.length > 0) {
                    setMatches(collectedMatches);
                    setLoading(false);
                  } else {
                    await loadMatchData();
                  }
                }
              }, 1500);
            }
          });

      } catch {
        await loadMatchData();
      }
    })();
  }, [matchId]);

  const loadMatchData = async () => {
    // Fallback: load match metadata and recent photos as placeholder
    try {
      const { data: match } = await supabase
        .from("lobbies")
        .select("catalog_id, mode")
        .eq("id", matchId)
        .single();

      if (match?.catalog_id) {
        const { data: photos } = await supabase
          .from("photos")
          .select("id, url, title")
          .eq("catalog_id", match.catalog_id)
          .limit(6);

        // Show as "potential matches" since we have no real swipe data persisted
        setMatches(
          (photos ?? []).slice(0, 3).map((p: any) => ({
            id:        p.id,
            url: p.url,
            title:     p.title ?? null,
            likedBy:   [],
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExit = async () => {
    // Mark lobby as finished
    await supabase
      .from("lobbies")
      .update({ status: "finished", finished_at: new Date().toISOString() })
      .eq("id", matchId);

    if (amGuest) {
      await clearGuestSession();
      router.replace("/guest/join/[code]" as any);
    } else {
      router.replace("/(tabs)");
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>Tallying results…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* Hero header */}
      <Animated.View
        style={[
          styles.hero,
          {
            opacity:   headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
          },
        ]}
      >
        <View style={styles.heroIcon}>
          <Ionicons name="trophy" size={36} color={C.accent} />
        </View>
        <Text style={styles.heroTitle}>Match Complete!</Text>
        <Text style={styles.heroSubtitle}>
          {winnerPhotoUrl
            ? "First match found!"
            : matches.length > 0
              ? `${matches.length} photo${matches.length > 1 ? "s" : ""} matched`
              : "No matches this round"}
        </Text>
      </Animated.View>

      {/* Players who participated */}
      {players.length > 0 && (
        <View style={styles.playersRow}>
          {players.map((p) => (
            <View key={p.id} style={styles.playerChip}>
              <View style={styles.playerAvatar}>
                <Text style={styles.playerAvatarText}>
                  {p.displayName.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.playerName} numberOfLines={1}>{p.displayName}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Winner card (first_match mode) */}
      {winnerPhotoUrl ? (
        <View style={styles.winnerSection}>
          <Text style={styles.winnerLabel}>THE MATCH</Text>
          <Animated.View
            style={[
              styles.winnerCard,
              {
                opacity:   headerAnim,
                transform: [{ scale: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }],
              },
            ]}
          >
            <Image source={{ uri: winnerPhotoUrl }} style={styles.winnerImage} contentFit="cover" />
            {winnerPhotoTitle ? (
              <View style={styles.winnerFooter}>
                <Text style={styles.winnerTitle}>{winnerPhotoTitle}</Text>
              </View>
            ) : null}
          </Animated.View>
        </View>
      ) : matches.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Matched Photos</Text>
          <FlatList
            data={matches}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={{ gap: SPACING.sm }}
            contentContainerStyle={styles.grid}
            renderItem={({ item, index }) => (
              <MatchCard photo={item} index={index} />
            )}
          />
        </>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="heart-dislike-outline" size={48} color={C.textMuted} />
          <Text style={styles.emptyTitle}>No matches this round</Text>
          <Text style={styles.emptySubtitle}>
            Try swiping with more players for better results!
          </Text>
        </View>
      )}

      {/* Exit button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.sm }]}>
        <Pressable style={styles.exitBtn} onPress={handleExit}>
          <Ionicons name="home-outline" size={18} color={C.bg} />
          <Text style={styles.exitBtnText}>Back to Home</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── MatchCard ─────────────────────────────────────────────────────────────────

function MatchCard({ photo, index }: { photo: MatchedPhoto; index: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue:         1,
      duration:        400,
      delay:           index * 80,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.matchCard,
        {
          opacity:   anim,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
        },
      ]}
    >
      <Image
        source={{ uri: photo.url }}
        style={styles.matchCardImage}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.matchBadge}>
        <Ionicons name="heart" size={12} color={C.danger} />
        {photo.likedBy.length > 0 && (
          <Text style={styles.matchBadgeText}>{photo.likedBy.length}</Text>
        )}
      </View>
      {photo.title ? (
        <View style={styles.matchCardFooter}>
          <Text style={styles.matchCardTitle} numberOfLines={1}>{photo.title}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: C.textMuted, fontSize: FONT_SIZE.md },

  hero: {
    alignItems:    "center",
    paddingTop:    SPACING.xl,
    paddingBottom: SPACING.lg,
    gap:           SPACING.sm,
  },
  heroIcon: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: C.accentSubtle,
    borderWidth:     1,
    borderColor:     C.borderAccent,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    SPACING.sm,
  },
  heroTitle:    { color: C.text, fontSize: FONT_SIZE.xxl, fontWeight: "900" },
  heroSubtitle: { color: C.textMuted, fontSize: FONT_SIZE.base },

  playersRow: {
    flexDirection:     "row",
    justifyContent:    "center",
    flexWrap:          "wrap",
    gap:               SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginBottom:      SPACING.lg,
  },
  playerChip: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               SPACING.xs,
    backgroundColor:   C.surface,
    borderRadius:      RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.xs,
    borderWidth:       1,
    borderColor:       C.border,
  },
  playerAvatar: {
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: C.accentDim,
    alignItems:      "center",
    justifyContent:  "center",
  },
  playerAvatarText: { color: C.bg, fontSize: 10, fontWeight: "800" },
  playerName: {
    color:    C.textSecondary,
    fontSize: FONT_SIZE.sm,
    maxWidth: 90,
  },

  sectionTitle: {
    color:             C.text,
    fontSize:          FONT_SIZE.xs,
    fontWeight:        "700",
    letterSpacing:     1.2,
    textTransform:     "uppercase",
    paddingHorizontal: SPACING.lg,
    marginBottom:      SPACING.md,
  },

  grid: {
    paddingHorizontal: SPACING.lg,
    paddingBottom:     100,
    gap:               SPACING.sm,
  },

  matchCard: {
    flex:            1,
    borderRadius:    RADIUS.lg,
    overflow:        "hidden",
    backgroundColor: C.surface,
    aspectRatio:     0.85,
    position:        "relative",
  },
  matchCardImage: { width: "100%", height: "100%" },
  matchBadge: {
    position:          "absolute",
    top:               SPACING.sm,
    right:             SPACING.sm,
    flexDirection:     "row",
    alignItems:        "center",
    gap:               3,
    backgroundColor:   C.dangerSubtle,
    borderRadius:      RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   3,
    borderWidth:       1,
    borderColor:       C.danger + "60",
  },
  matchBadgeText: { color: C.danger, fontSize: 11, fontWeight: "700" },
  matchCardFooter: {
    position:          "absolute",
    bottom:            0,
    left:              0,
    right:             0,
    backgroundColor:   "rgba(0,0,0,0.65)",
    paddingHorizontal: SPACING.sm,
    paddingVertical:   SPACING.xs,
  },
  matchCardTitle: { color: C.text, fontSize: FONT_SIZE.xs, fontWeight: "600" },

  winnerSection: {
    alignItems:        "center",
    paddingHorizontal: SPACING.lg,
    paddingBottom:     100,
    gap:               SPACING.sm,
  },
  winnerLabel: {
    color:         C.accent,
    fontSize:      FONT_SIZE.xs,
    fontWeight:    "900",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  winnerCard: {
    width:           "100%",
    borderRadius:    RADIUS.xl,
    overflow:        "hidden",
    backgroundColor: C.surface,
    borderWidth:     2,
    borderColor:     C.borderAccent,
    aspectRatio:     1,
  },
  winnerImage: { width: "100%", height: "100%" },
  winnerFooter: {
    position:          "absolute",
    bottom:            0,
    left:              0,
    right:             0,
    backgroundColor:   "rgba(0,0,0,0.65)",
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.md,
  },
  winnerTitle: {
    color:      C.text,
    fontSize:   FONT_SIZE.lg,
    fontWeight: "700",
    textAlign:  "center",
  },

  emptyState: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    gap:            SPACING.sm,
    paddingBottom:  80,
  },
  emptyTitle:    { color: C.text,    fontSize: FONT_SIZE.xl,   fontWeight: "700" },
  emptySubtitle: { color: C.textMuted, fontSize: FONT_SIZE.sm, textAlign: "center", paddingHorizontal: SPACING.xl },

  footer: {
    position:          "absolute",
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: SPACING.lg,
    paddingTop:        SPACING.md,
    backgroundColor:   C.bg,
    borderTopWidth:    1,
    borderTopColor:    C.border,
  },
  exitBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             SPACING.sm,
    backgroundColor: C.accent,
    borderRadius:    RADIUS.lg,
    paddingVertical: SPACING.md,
  },
  exitBtnText: {
    color:      C.bg,
    fontSize:   FONT_SIZE.lg,
    fontWeight: "800",
  },
});
