import { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, Pressable, Animated,
  PanResponder, ActivityIndicator, Alert, Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../../services/supabase";
import { COLORS, SPACING, RADIUS, FONT_SIZE, ANIMATION } from "../../config/theme";
import { SWIPE } from "../../config/constants";

const C = COLORS;
const { width: SW, height: SH } = Dimensions.get("window");
const CARD_H = SH * 0.58;

// ─── Types ────────────────────────────────────────────────────────────────────

type SwipeAction = "like" | "dislike" | "super_like";

type PhotoCard = {
  id:        string;
  image_url: string;
  title?:    string | null;
};

type SwipePayload = {
  playerId: string;
  photoId:  string;
  action:   SwipeAction;
};

type MatchPayload = {
  photoId:    string;
  imageUrl:   string;
  title?:     string | null;
  matchedBy:  string[];
};

type Params = {
  matchId:   string;
  mode?:     string;
  isGuest?:  string;
  guestId?:  string;
  guestName?: string;
};

/**
 * Displays a full-screen "It's a Match!" overlay for a photo with animated entrance and automatic dismissal.
 *
 * The overlay shows the photo, an optional title, and a "Keep Swiping" button that also dismisses the overlay. The overlay automatically calls `onDismiss` after 2800 milliseconds.
 *
 * @param photo - The matched photo to display (image_url and optional title are used).
 * @param onDismiss - Callback invoked when the overlay is dismissed (button press or automatic timeout).
 * @returns A React element rendering the animated match overlay.
 */

function MatchOverlay({ photo, onDismiss }: { photo: PhotoCard; onDismiss: () => void }) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(onDismiss, 2800);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[styles.matchOverlay, { opacity }]}>
      <Animated.View style={[styles.matchCard, { transform: [{ scale }] }]}>
        <Image source={{ uri: photo.image_url }} style={styles.matchCardImage} contentFit="cover" />
        <View style={styles.matchCardBody}>
          <Text style={styles.matchTitle}>It's a Match!</Text>
          {photo.title ? <Text style={styles.matchSubtitle}>{photo.title}</Text> : null}
          <Pressable style={styles.matchDismissBtn} onPress={onDismiss}>
            <Text style={styles.matchDismissText}>Keep Swiping</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Renders a photo card for the swipe deck, displaying either a static stacked card or a draggable top card.
 *
 * When `isTop` is true the card is draggable and shows animated "LIKE" / "NOPE" badges while being swiped; releasing beyond thresholds will animate the card off-screen and invoke `onSwipe` with the chosen action.
 *
 * @param photo - Photo data to display (image_url and optional title)
 * @param isTop - Whether this card is the active, draggable top card in the stack
 * @param stackIndex - Zero-based index of the card within the visible stack (0 is top); used to compute scale/offset for non-top cards
 * @param onSwipe - Callback invoked with the swipe action (`"like"` | `"dislike"` | `"super_like"`) when the top card is swiped away
 * @returns The rendered card element; draggable behavior and swipe callbacks are active only when `isTop` is true
 */

function SwipeCard({
  photo,
  isTop,
  stackIndex,
  onSwipe,
}: {
  photo:      PhotoCard;
  isTop:      boolean;
  stackIndex: number;
  onSwipe:    (action: SwipeAction) => void;
}) {
  const pan      = useRef(new Animated.ValueXY()).current;
  const likeOp   = useRef(new Animated.Value(0)).current;
  const nopeOp   = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isTop,
      onMoveShouldSetPanResponder:  () => isTop,
      onPanResponderMove: (_, { dx, dy }) => {
        pan.setValue({ x: dx, y: dy });
        const ratio = dx / SWIPE.THRESHOLD;
        likeOp.setValue(Math.max(0, Math.min(1,  ratio)));
        nopeOp.setValue(Math.max(0, Math.min(1, -ratio)));
      },
      onPanResponderRelease: (_, { dx, vx }) => {
        const absX = Math.abs(dx);
        if (absX > SWIPE.THRESHOLD || Math.abs(vx) > SWIPE.VELOCITY_THRESHOLD) {
          const dir = dx > 0 ? 1 : -1;
          Animated.timing(pan, {
            toValue:         { x: dir * SW * 1.5, y: 0 },
            duration:        ANIMATION.durationNormal,
            useNativeDriver: true,
          }).start(() => onSwipe(dx > 0 ? "like" : "dislike"));
        } else {
          Animated.spring(pan, {
            toValue:         { x: 0, y: 0 },
            friction:        5,
            useNativeDriver: true,
          }).start();
          Animated.timing(likeOp, { toValue: 0, duration: 150, useNativeDriver: true }).start();
          Animated.timing(nopeOp, { toValue: 0, duration: 150, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const rotate = pan.x.interpolate({
    inputRange:  [-SW / 2, 0, SW / 2],
    outputRange: [`-${SWIPE.MAX_ROTATION_DEG}deg`, "0deg", `${SWIPE.MAX_ROTATION_DEG}deg`],
    extrapolate: "clamp",
  });

  const scaleVal = isTop ? 1 : 1 - stackIndex * 0.035;
  const translateY = isTop ? 0 : stackIndex * 8;

  if (!isTop) {
    return (
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ scale: scaleVal }, { translateY }],
            zIndex:    -stackIndex,
          },
        ]}
      >
        <Image source={{ uri: photo.image_url }} style={styles.cardImage} contentFit="cover" />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.card,
        { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }], zIndex: 10 },
      ]}
      {...panResponder.panHandlers}
    >
      <Image source={{ uri: photo.image_url }} style={styles.cardImage} contentFit="cover" />

      {/* Like badge */}
      <Animated.View style={[styles.badge, styles.badgeLike, { opacity: likeOp }]}>
        <Ionicons name="heart" size={28} color={C.success} />
        <Text style={[styles.badgeText, { color: C.success }]}>LIKE</Text>
      </Animated.View>

      {/* Nope badge */}
      <Animated.View style={[styles.badge, styles.badgeNope, { opacity: nopeOp }]}>
        <Ionicons name="close" size={28} color={C.danger} />
        <Text style={[styles.badgeText, { color: C.danger }]}>NOPE</Text>
      </Animated.View>

      {photo.title ? (
        <View style={styles.cardFooter}>
          <Text style={styles.cardTitle} numberOfLines={2}>{photo.title}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

/**
 * Screen component that presents a swipeable deck of photos for a realtime matching session.
 *
 * Renders a stacked, interactive card deck with like/dislike/super-like actions, displays progress and participant counts, and shows a match overlay when a photo is matched.
 *
 * The component loads photos for the provided `matchId`, tracks and broadcasts player swipes over a Supabase realtime channel, updates presence-based player counts, and navigates to the results screen after the deck is completed.
 *
 * @returns The JSX element for the swipe screen.
 */

export default function SwipeScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Params>();
  const { matchId, mode = "first_match", isGuest, guestId, guestName } = params;
  const amGuest = isGuest === "1";

  const [photos,       setPhotos]       = useState<PhotoCard[]>([]);
  const [index,        setIndex]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [matchedPhoto, setMatchedPhoto] = useState<PhotoCard | null>(null);
  const [playerCount,  setPlayerCount]  = useState(1);
  const [done,         setDone]         = useState(false);

  const myId = useRef<string>("");
  // photoId → Set of playerIds who liked it
  const likedBy = useRef<Map<string, Set<string>>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Identify self ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (amGuest) {
        myId.current = guestId ?? "guest-" + Math.random().toString(36).slice(2, 7);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        myId.current = user?.id ?? "anon";
      }
    })();
  }, []);

  // ── Load photos ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!matchId) return;
    (async () => {
      try {
        // Try to get the catalog linked to this match
        const { data: match } = await supabase
          .from("matches")
          .select("catalog_id")
          .eq("id", matchId)
          .single();

        let photos: PhotoCard[] = [];

        if (match?.catalog_id) {
          const { data } = await supabase
            .from("photos")
            .select("id, image_url, title")
            .eq("catalog_id", match.catalog_id)
            .order("sort_order", { ascending: true })
            .limit(50);
          photos = (data ?? []) as PhotoCard[];
        }

        // Fallback: recent public photos from any catalog
        if (photos.length === 0) {
          const { data } = await supabase
            .from("photos")
            .select("id, image_url, title")
            .order("created_at", { ascending: false })
            .limit(30);
          photos = (data ?? []) as PhotoCard[];
        }

        setPhotos(photos);
      } finally {
        setLoading(false);
      }
    })();
  }, [matchId]);

  // ── Realtime swipe channel ─────────────────────────────────────────────────
  useEffect(() => {
    if (!matchId) return;

    const channel = supabase.channel(`match-presence:${matchId}`);
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setPlayerCount(Object.values(state).flat().length || 1);
      })
      .on("broadcast", { event: "player_swipe" }, ({ payload }: { payload: SwipePayload }) => {
        if (payload.action !== "like" && payload.action !== "super_like") return;

        const set = likedBy.current.get(payload.photoId) ?? new Set();
        set.add(payload.playerId);
        likedBy.current.set(payload.photoId, set);

        // Match detected when ≥ 2 players liked the same photo
        setPlayerCount((count) => {
          const needed = Math.min(2, count);
          if (set.size >= needed) {
            const photo = photos.find((p) => p.id === payload.photoId);
            if (photo) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setMatchedPhoto(photo);
              // Broadcast to all so everyone shows the match overlay
              channel.send({
                type:    "broadcast",
                event:   "match_found",
                payload: { photoId: photo.id, imageUrl: photo.image_url, title: photo.title ?? null, matchedBy: [...set] } satisfies MatchPayload,
              });
            }
          }
          return count;
        });
      })
      .on("broadcast", { event: "match_found" }, ({ payload }: { payload: MatchPayload }) => {
        setPhotos((prev) => {
          const photo = prev.find((p) => p.id === payload.photoId);
          if (photo) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setMatchedPhoto(photo);
          }
          return prev;
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const { data: { user } } = await supabase.auth.getUser();
          await channel.track({
            type:        amGuest ? "guest" : "user",
            id:          myId.current,
            displayName: amGuest ? (guestName ?? "Guest") : (user?.email?.split("@")[0] ?? "Unknown"),
            isHost:      false,
          });
        }
      });

    return () => { channel.unsubscribe(); };
  }, [matchId, photos.length]);

  // ── Handle swipe ──────────────────────────────────────────────────────────
  const handleSwipe = useCallback(
    (action: SwipeAction) => {
      if (index >= photos.length) return;
      const photo = photos[index];

      Haptics.impactAsync(
        action === "like" || action === "super_like"
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light
      );

      // Track own like
      if (action === "like" || action === "super_like") {
        const set = likedBy.current.get(photo.id) ?? new Set();
        set.add(myId.current);
        likedBy.current.set(photo.id, set);
      }

      // Broadcast to other players
      channelRef.current?.send({
        type:    "broadcast",
        event:   "player_swipe",
        payload: { playerId: myId.current, photoId: photo.id, action } satisfies SwipePayload,
      });

      const next = index + 1;
      setIndex(next);

      if (next >= photos.length) {
        setDone(true);
      }
    },
    [index, photos]
  );

  // Button-driven swipe (animates card off screen, then calls handleSwipe)
  const btnRef = useRef<Animated.ValueXY>(new Animated.ValueXY());
  const triggerSwipe = (direction: "like" | "dislike") => {
    handleSwipe(direction);
  };

  // ── Done: navigate to results ─────────────────────────────────────────────
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => {
      router.replace({
        pathname: "/lobby/results",
        params:   { matchId, isGuest: isGuest ?? "0", guestId: guestId ?? "", guestName: guestName ?? "" },
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [done]);

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>Loading photos…</Text>
      </View>
    );
  }

  // ─── Empty ────────────────────────────────────────────────────────────────
  if (photos.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <Ionicons name="images-outline" size={48} color={C.textMuted} />
        <Text style={styles.emptyText}>No photos in this match.</Text>
        <Pressable style={styles.leaveBtn} onPress={() => router.back()}>
          <Text style={styles.leaveBtnText}>Leave</Text>
        </Pressable>
      </View>
    );
  }

  const remaining = photos.length - index;
  const progress  = photos.length > 0 ? index / photos.length : 0;
  const visibleCards = photos.slice(index, index + SWIPE.PREFETCH_COUNT);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.headerLeave}
          onPress={() =>
            Alert.alert("Leave match?", "Your progress will be lost.", [
              { text: "Stay",  style: "cancel" },
              { text: "Leave", style: "destructive", onPress: () => router.back() },
            ])
          }
        >
          <Ionicons name="exit-outline" size={18} color={C.danger} />
          <Text style={styles.headerLeaveText}>Leave</Text>
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerMode}>
            {mode === "first_match" ? "First Match" : mode === "deck" ? "Full Deck" : "Tournament"}
          </Text>
          <Text style={styles.headerCount}>
            {remaining > 0 ? `${remaining} left` : "All done!"}
          </Text>
        </View>

        <View style={styles.playersBadge}>
          <Ionicons name="people-outline" size={14} color={C.textMuted} />
          <Text style={styles.playersBadgeText}>{playerCount}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
      </View>

      {/* Card stack or done state */}
      <View style={styles.deckArea}>
        {done || remaining === 0 ? (
          <View style={styles.doneCard}>
            <Ionicons name="checkmark-circle" size={64} color={C.accent} />
            <Text style={styles.doneTitle}>All done!</Text>
            <Text style={styles.doneSubtitle}>Waiting for results…</Text>
            <ActivityIndicator color={C.accent} style={{ marginTop: SPACING.md }} />
          </View>
        ) : (
          [...visibleCards].reverse().map((photo, i) => {
            const stackIndex = visibleCards.length - 1 - i;
            return (
              <SwipeCard
                key={photo.id}
                photo={photo}
                isTop={stackIndex === 0}
                stackIndex={stackIndex}
                onSwipe={handleSwipe}
              />
            );
          })
        )}
      </View>

      {/* Action buttons */}
      {!done && remaining > 0 && (
        <View style={[styles.actions, { paddingBottom: insets.bottom + SPACING.sm }]}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.actionDislike, pressed && { opacity: 0.75 }]}
            onPress={() => triggerSwipe("dislike")}
          >
            <Ionicons name="close" size={32} color={C.danger} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.actionSuperLike, pressed && { opacity: 0.75 }]}
            onPress={() => handleSwipe("super_like")}
          >
            <Ionicons name="star" size={24} color={C.accent} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.actionLike, pressed && { opacity: 0.75 }]}
            onPress={() => triggerSwipe("like")}
          >
            <Ionicons name="heart" size={28} color={C.success} />
          </Pressable>
        </View>
      )}

      {/* Match overlay */}
      {matchedPhoto && (
        <MatchOverlay
          photo={matchedPhoto}
          onDismiss={() => setMatchedPhoto(null)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: C.bg },
  loadingText: { color: C.textMuted, fontSize: FONT_SIZE.md },
  emptyText:   { color: C.textMuted, fontSize: FONT_SIZE.lg, marginTop: SPACING.sm },

  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.sm,
  },
  headerLeave: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             4,
    backgroundColor: C.dangerSubtle,
    borderRadius:    RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  headerLeaveText: { color: C.danger, fontSize: FONT_SIZE.sm, fontWeight: "700" },
  headerCenter:    { alignItems: "center" },
  headerMode:      { color: C.text, fontSize: FONT_SIZE.base, fontWeight: "700" },
  headerCount:     { color: C.textMuted, fontSize: FONT_SIZE.xs, marginTop: 1 },
  playersBadge: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           4,
    backgroundColor: C.surface,
    borderRadius:    RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   5,
    borderWidth:       1,
    borderColor:       C.border,
  },
  playersBadgeText: { color: C.textMuted, fontSize: FONT_SIZE.sm, fontWeight: "600" },

  progressTrack: {
    height:          3,
    backgroundColor: C.surface,
    marginHorizontal: SPACING.lg,
    borderRadius:    RADIUS.full,
    overflow:        "hidden",
  },
  progressFill: {
    height:          3,
    backgroundColor: C.accent,
    borderRadius:    RADIUS.full,
  },

  deckArea: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    marginTop:      SPACING.md,
  },

  card: {
    position:        "absolute",
    width:           SW - SPACING.lg * 2,
    height:          CARD_H,
    borderRadius:    RADIUS.xl,
    overflow:        "hidden",
    backgroundColor: C.surface,
  },
  cardImage: { width: "100%", height: "100%" },
  cardFooter: {
    position:         "absolute",
    bottom:           0,
    left:             0,
    right:            0,
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.md,
    backgroundColor:  "rgba(0,0,0,0.6)",
  },
  cardTitle: {
    color:      C.text,
    fontSize:   FONT_SIZE.lg,
    fontWeight: "700",
  },

  badge: {
    position:          "absolute",
    top:               SPACING.xl,
    flexDirection:     "row",
    alignItems:        "center",
    gap:               SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    borderRadius:      RADIUS.md,
    borderWidth:       3,
  },
  badgeLike: {
    right:       SPACING.xl,
    borderColor: C.success,
    backgroundColor: C.successSubtle,
  },
  badgeNope: {
    left:        SPACING.xl,
    borderColor: C.danger,
    backgroundColor: C.dangerSubtle,
  },
  badgeText: { fontSize: FONT_SIZE.lg, fontWeight: "900", letterSpacing: 1 },

  doneCard: {
    alignItems:     "center",
    justifyContent: "center",
    gap:            SPACING.sm,
  },
  doneTitle:    { color: C.text,    fontSize: FONT_SIZE.xxl, fontWeight: "800" },
  doneSubtitle: { color: C.textMuted, fontSize: FONT_SIZE.base },

  actions: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    gap:               SPACING.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop:        SPACING.lg,
  },
  actionBtn: {
    alignItems:      "center",
    justifyContent:  "center",
    borderRadius:    RADIUS.full,
    borderWidth:     2,
  },
  actionDislike: {
    width:           64,
    height:          64,
    borderColor:     C.danger,
    backgroundColor: C.dangerSubtle,
  },
  actionSuperLike: {
    width:           52,
    height:          52,
    borderColor:     C.accent,
    backgroundColor: C.accentSubtle,
  },
  actionLike: {
    width:           64,
    height:          64,
    borderColor:     C.success,
    backgroundColor: C.successSubtle,
  },

  leaveBtn: {
    marginTop:         SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.sm,
    backgroundColor:   C.surface,
    borderRadius:      RADIUS.full,
    borderWidth:       1,
    borderColor:       C.border,
  },
  leaveBtnText: { color: C.text, fontSize: FONT_SIZE.base, fontWeight: "600" },

  // Match overlay
  matchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.82)",
    alignItems:      "center",
    justifyContent:  "center",
    zIndex:          100,
  },
  matchCard: {
    width:           SW - SPACING.xl * 2,
    borderRadius:    RADIUS.xl,
    overflow:        "hidden",
    backgroundColor: C.surface,
  },
  matchCardImage: {
    width:  "100%",
    height: 240,
  },
  matchCardBody: {
    alignItems:    "center",
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    gap:           SPACING.sm,
  },
  matchTitle: {
    color:      C.accent,
    fontSize:   FONT_SIZE.xxxl,
    fontWeight: "900",
    letterSpacing: 1,
  },
  matchSubtitle: {
    color:    C.textSecondary,
    fontSize: FONT_SIZE.base,
  },
  matchDismissBtn: {
    marginTop:         SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical:   SPACING.sm,
    backgroundColor:   C.accent,
    borderRadius:      RADIUS.full,
  },
  matchDismissText: {
    color:      C.bg,
    fontSize:   FONT_SIZE.base,
    fontWeight: "800",
  },
});
