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
import { normalizeStorageUrl } from "../../services/storage";
import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../config/theme";

const C = COLORS;

type Params = {
  matchId:           string;
  mode?:             string;
  isGuest?:          string;
  guestId?:          string;
  guestName?:        string;
  winnerPhotoId?:    string;
  winnerPhotoUrl?:   string;
  winnerPhotoTitle?: string;
  deckVotes?:        string;
};

type MatchedPhoto = {
  id:      string;
  url:     string;
  title?:  string | null;
  likedBy: string[];
};

type RankedPhoto = {
  id:     string;
  url:    string;
  title?: string | null;
  votes:  number;
};

// ─── Rank helpers ─────────────────────────────────────────────────────────────

const MEDAL_ICONS = ["trophy", "medal", "ribbon"] as const;
const MEDAL_COLORS = [C.accent, "#C0C0C0", "#CD7F32"] as const;

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <View style={[styles.medalBadge, { backgroundColor: MEDAL_COLORS[rank - 1] + "22" }]}>
        <Ionicons name={MEDAL_ICONS[rank - 1]} size={20} color={MEDAL_COLORS[rank - 1]} />
      </View>
    );
  }
  return (
    <View style={styles.rankNumBadge}>
      <Text style={styles.rankNum}>#{rank}</Text>
    </View>
  );
}

function RankRow({ item, rank, index }: { item: RankedPhoto; rank: number; index: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue:         1,
      duration:        380,
      delay:           index * 60,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.rankRow,
        rank === 1 && styles.rankRowFirst,
        {
          opacity:   anim,
          transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
        },
      ]}
    >
      <RankBadge rank={rank} />

      <Image
        source={{ uri: item.url }}
        style={styles.rankThumb}
        contentFit="cover"
        transition={200}
      />

      <View style={styles.rankInfo}>
        <Text style={styles.rankTitle} numberOfLines={2}>
          {item.title ?? "Untitled"}
        </Text>
        <View style={styles.rankVotesRow}>
          <Ionicons name="heart" size={12} color={C.danger} />
          <Text style={styles.rankVotesText}>
            {item.votes} {item.votes === 1 ? "vote" : "votes"}
          </Text>
        </View>
      </View>

      {/* Vote bar */}
      <View style={styles.voteBarWrap}>
        <View style={[styles.voteBar, { height: `${Math.min(100, item.votes * 20)}%` as any }]} />
      </View>
    </Animated.View>
  );
}

// ─── MatchCard (for first_match / broadcast results) ─────────────────────────

function MatchCard({ photo, index }: { photo: MatchedPhoto; index: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true,
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Params>();
  const {
    matchId, mode, isGuest, guestId, guestName,
    winnerPhotoUrl, winnerPhotoTitle, deckVotes,
  } = params;
  const amGuest  = isGuest === "1";
  const isDeck   = mode === "deck";

  const [matches,       setMatches]       = useState<MatchedPhoto[]>([]);
  const [rankedPhotos,  setRankedPhotos]  = useState<RankedPhoto[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [players,       setPlayers]       = useState<{ id: string; displayName: string }[]>([]);

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1, duration: 600, delay: 200, useNativeDriver: true,
    }).start();
  }, []);

  // ── Deck mode: parse ranked votes and fetch photo details ─────────────────
  useEffect(() => {
    if (!isDeck || !deckVotes) return;
    (async () => {
      try {
        const ranked: { photoId: string; votes: number }[] = JSON.parse(deckVotes);
        const positiveVotes = ranked.filter((r) => r.votes > 0);

        if (positiveVotes.length === 0) {
          setRankedPhotos([]);
          setLoading(false);
          return;
        }

        const { data } = await supabase
          .from("photos")
          .select("id, url, title")
          .in("id", positiveVotes.map((r) => r.photoId));

        const photoMap = new Map((data ?? []).map((p: any) => [p.id, p]));

        setRankedPhotos(
          positiveVotes.map((r) => {
            const photo = photoMap.get(r.photoId);
            return {
              id:    r.photoId,
              url:   normalizeStorageUrl(photo?.url ?? "") ?? photo?.url ?? "",
              title: photo?.title ?? null,
              votes: r.votes,
            };
          })
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [isDeck, deckVotes]);

  // ── Non-deck mode: collect match_found broadcasts ─────────────────────────
  useEffect(() => {
    if (isDeck || !matchId) return;

    (async () => {
      try {
        const channel = supabase.channel(`match-presence:${matchId}`);
        let resolved = false;

        const timeout = setTimeout(async () => {
          if (!resolved) { resolved = true; channel.unsubscribe(); await loadMatchData(); }
        }, 3000);

        const collectedMatches: MatchedPhoto[] = [];

        channel
          .on("presence", { event: "sync" }, () => {
            const state = channel.presenceState<{ id: string; displayName: string }>();
            setPlayers(Object.values(state).flat().map((p) => ({ id: p.id, displayName: p.displayName })));
          })
          .on("broadcast", { event: "match_found" }, ({ payload }) => {
            if (!collectedMatches.some((m) => m.id === payload.photoId)) {
              collectedMatches.push({
                id:      payload.photoId,
                url:     payload.imageUrl,
                title:   payload.title ?? null,
                likedBy: payload.matchedBy ?? [],
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
  }, [matchId, isDeck]);

  const loadMatchData = async () => {
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

        setMatches(
          (photos ?? []).slice(0, 3).map((p: any) => ({
            id:      p.id,
            url:     p.url,
            title:   p.title ?? null,
            likedBy: [],
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExit = async () => {
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

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>Tallying results…</Text>
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
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
          <Ionicons name={isDeck ? "podium" : "trophy"} size={36} color={C.accent} />
        </View>
        <Text style={styles.heroTitle}>
          {isDeck ? "Full Deck Results" : "Match Complete!"}
        </Text>
        <Text style={styles.heroSubtitle}>
          {isDeck
            ? rankedPhotos.length > 0
              ? `${rankedPhotos.length} photo${rankedPhotos.length > 1 ? "s" : ""} received votes`
              : "No votes this round"
            : winnerPhotoUrl
              ? "First match found!"
              : matches.length > 0
                ? `${matches.length} photo${matches.length > 1 ? "s" : ""} matched`
                : "No matches this round"}
        </Text>
      </Animated.View>

      {/* Players row (non-deck) */}
      {!isDeck && players.length > 0 && (
        <View style={styles.playersRow}>
          {players.map((p) => (
            <View key={p.id} style={styles.playerChip}>
              <View style={styles.playerAvatar}>
                <Text style={styles.playerAvatarText}>{p.displayName.slice(0, 2).toUpperCase()}</Text>
              </View>
              <Text style={styles.playerName} numberOfLines={1}>{p.displayName}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── DECK MODE: ranked list ──────────────────────────────────────────── */}
      {isDeck ? (
        rankedPhotos.length > 0 ? (
          <FlatList
            data={rankedPhotos}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.rankList}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <Text style={styles.sectionTitle}>Ranking by Votes</Text>
            }
            renderItem={({ item, index }) => (
              <RankRow item={item} rank={index + 1} index={index} />
            )}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="heart-dislike-outline" size={48} color={C.textMuted} />
            <Text style={styles.emptyTitle}>No votes this round</Text>
            <Text style={styles.emptySubtitle}>
              Swipe right on photos you like to see them ranked here!
            </Text>
          </View>
        )
      ) : (
        /* ── NON-DECK MODE ─────────────────────────────────────────────────── */
        winnerPhotoUrl ? (
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
        )
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
  heroTitle:    { color: C.text,    fontSize: FONT_SIZE.xxl, fontWeight: "900" },
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

  // ── Deck ranking ────────────────────────────────────────────────────────────

  rankList: {
    paddingHorizontal: SPACING.lg,
    paddingBottom:     100,
    gap:               SPACING.sm,
  },

  rankRow: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             SPACING.md,
    backgroundColor: C.surface,
    borderRadius:    RADIUS.lg,
    padding:         SPACING.sm,
    borderWidth:     1,
    borderColor:     C.border,
  },
  rankRowFirst: {
    borderColor:     C.borderAccent,
    backgroundColor: C.accentSubtle,
  },

  medalBadge: {
    width:          42,
    height:         42,
    borderRadius:   RADIUS.md,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  rankNumBadge: {
    width:          42,
    height:         42,
    borderRadius:   RADIUS.md,
    alignItems:     "center",
    justifyContent: "center",
    backgroundColor: C.surfaceHigh,
    flexShrink:     0,
  },
  rankNum: {
    color:      C.textMuted,
    fontSize:   FONT_SIZE.sm,
    fontWeight: "700",
  },

  rankThumb: {
    width:           64,
    height:          64,
    borderRadius:    RADIUS.md,
    backgroundColor: C.surfaceHigh,
    flexShrink:      0,
  },

  rankInfo: { flex: 1 },
  rankTitle: {
    color:      C.text,
    fontSize:   FONT_SIZE.base,
    fontWeight: "700",
    marginBottom: 4,
  },
  rankVotesRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           4,
  },
  rankVotesText: {
    color:      C.textMuted,
    fontSize:   FONT_SIZE.xs,
    fontWeight: "600",
  },

  voteBarWrap: {
    width:           6,
    height:          48,
    backgroundColor: C.surfaceHigh,
    borderRadius:    RADIUS.full,
    overflow:        "hidden",
    justifyContent:  "flex-end",
    flexShrink:      0,
  },
  voteBar: {
    width:           6,
    backgroundColor: C.accent,
    borderRadius:    RADIUS.full,
  },

  // ── Grid (non-deck matches) ─────────────────────────────────────────────────

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

  // ── Winner (first_match) ────────────────────────────────────────────────────

  winnerSection: {
    alignItems:        "center",
    alignSelf:         "center",
    width:             "100%",
    maxWidth:          600,
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
    maxWidth:        560,
    alignSelf:       "center",
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

  // ── Empty state ─────────────────────────────────────────────────────────────

  emptyState: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    gap:            SPACING.sm,
    paddingBottom:  80,
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle:    { color: C.text,    fontSize: FONT_SIZE.xl,   fontWeight: "700" },
  emptySubtitle: { color: C.textMuted, fontSize: FONT_SIZE.sm, textAlign: "center" },

  // ── Footer ──────────────────────────────────────────────────────────────────

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
