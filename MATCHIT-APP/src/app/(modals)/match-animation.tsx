import { useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { goBack } from "../../utils/navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withDelay, withSequence, withTiming,
  FadeIn,
} from "react-native-reanimated";

import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../config/theme";

const C = COLORS;

type Params = {
  photoUri?:   string;
  photoTitle?: string;
  matchedBy?:  string; // comma-separated display names
};

export default function MatchAnimationModal() {
  const insets = useSafeAreaInsets();
  const { photoUri, photoTitle, matchedBy } = useLocalSearchParams<Params>();

  const cardScale   = useSharedValue(0.6);
  const cardOpacity = useSharedValue(0);
  const heartScale  = useSharedValue(0);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    // Card entrance
    cardScale.value   = withSpring(1, { damping: 12, stiffness: 120 });
    cardOpacity.value = withTiming(1, { duration: 250 });

    // Heart burst
    heartScale.value = withDelay(
      300,
      withSequence(
        withSpring(1.4, { damping: 6, stiffness: 200 }),
        withSpring(1.0, { damping: 10 })
      )
    );

    // Text fade
    textOpacity.value = withDelay(400, withTiming(1, { duration: 300 }));

    // Auto-dismiss after 3 seconds
    const t = setTimeout(() => goBack(), 3000);
    return () => clearTimeout(t);
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity:   cardOpacity.value,
  }));

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const players = matchedBy
    ? matchedBy.split(",").map((n) => n.trim()).filter(Boolean)
    : [];

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

      {/* Background overlay */}
      <Animated.View entering={FadeIn.duration(200)} style={styles.bg} />

      <View style={styles.content}>

        {/* Animated card */}
        <Animated.View style={[styles.card, cardStyle]}>
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={styles.cardImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.cardImage, styles.cardImageFallback]}>
              <Ionicons name="images-outline" size={48} color={C.textMuted} />
            </View>
          )}

          {/* Heart badge */}
          <Animated.View style={[styles.heartBadge, heartStyle]}>
            <Ionicons name="heart" size={28} color={C.danger} />
          </Animated.View>
        </Animated.View>

        {/* Text */}
        <Animated.View style={[styles.textBlock, textStyle]}>
          <Text style={styles.matchLabel}>It's a Match!</Text>

          {photoTitle ? (
            <Text style={styles.photoTitle} numberOfLines={2}>{photoTitle}</Text>
          ) : null}

          {players.length > 0 && (
            <View style={styles.playersRow}>
              {players.map((name, i) => (
                <View key={i} style={styles.playerChip}>
                  <View style={styles.playerAvatar}>
                    <Text style={styles.playerAvatarText}>
                      {name.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.playerName}>{name}</Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        {/* Dismiss button */}
        <Animated.View style={[{ width: "100%", alignItems: "center" }, textStyle]}>
          <Pressable style={styles.dismissBtn} onPress={() => goBack()}>
            <Text style={styles.dismissText}>Continue Swiping</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
  },
  bg: {
    position:        "absolute",
    top:             0,
    left:            0,
    right:           0,
    bottom:          0,
    backgroundColor: "rgba(0,0,0,0.85)",
  },

  content: {
    alignItems: "center",
    gap:        SPACING.xl,
    width:      "100%",
    paddingHorizontal: SPACING.xl,
  },

  card: {
    width:           260,
    height:          300,
    borderRadius:    RADIUS.xl,
    overflow:        "hidden",
    backgroundColor: C.surface,
    position:        "relative",
  },
  cardImage: {
    width:  "100%",
    height: "100%",
  },
  cardImageFallback: {
    backgroundColor: C.surfaceHigh,
    alignItems:      "center",
    justifyContent:  "center",
  },

  heartBadge: {
    position:        "absolute",
    bottom:          -16,
    alignSelf:       "center",
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: C.bg,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     3,
    borderColor:     C.surface,
  },

  textBlock: {
    alignItems: "center",
    gap:        SPACING.md,
    marginTop:  SPACING.md,
  },
  matchLabel: {
    color:         C.accent,
    fontSize:      FONT_SIZE.huge,
    fontWeight:    "900",
    letterSpacing: 1,
    textAlign:     "center",
  },
  photoTitle: {
    color:     C.textSecondary,
    fontSize:  FONT_SIZE.base,
    textAlign: "center",
  },

  playersRow: {
    flexDirection: "row",
    gap:           SPACING.sm,
    flexWrap:      "wrap",
    justifyContent: "center",
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
    fontWeight: "600",
  },

  dismissBtn: {
    backgroundColor:   C.accent,
    borderRadius:      RADIUS.full,
    paddingHorizontal: SPACING.xxl,
    paddingVertical:   SPACING.md,
  },
  dismissText: {
    color:      C.bg,
    fontSize:   FONT_SIZE.base,
    fontWeight: "800",
  },
});
