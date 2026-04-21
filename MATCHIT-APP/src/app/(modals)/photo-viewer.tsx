import { useState } from "react";
import {
  View, Text, StyleSheet, Pressable,
  Dimensions, Share, StatusBar,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle, useSharedValue,
} from "react-native-reanimated";

import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../config/theme";

const { width: SW, height: SH } = Dimensions.get("window");
const C = COLORS;

type Params = {
  uri:    string;
  title?: string;
};

/**
 * Render a full-screen modal photo viewer that displays an image (from navigation params) with optional top and bottom chrome.
 *
 * Renders a tappable image area that toggles visibility of the status bar and chrome; when `uri` is absent it shows a centered fallback with a Close button. Reads `uri` and `title` from local search params and provides Close and Share controls when chrome is visible.
 *
 * @returns A React element representing the photo viewer screen. `uri`-dependent: displays the image when `uri` is present, otherwise renders the fallback view.
 */
export default function PhotoViewerModal() {
  const insets = useSafeAreaInsets();
  const { uri, title } = useLocalSearchParams<Params>();

  const [chromeVisible, setChromeVisible] = useState(true);
  const scale     = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const toggleChrome = () => setChromeVisible((v) => !v);

  const handleShare = async () => {
    if (!uri) return;
    try {
      await Share.share({ url: uri, message: title ?? "" });
    } catch { /* ignore */ }
  };

  const handleClose = () => router.back();

  if (!uri) {
    return (
      <View style={styles.center}>
        <Ionicons name="image-outline" size={44} color={C.textMuted} />
        <Text style={styles.errorText}>No image to display</Text>
        <Pressable style={styles.closeBtn} onPress={handleClose}>
          <Text style={styles.closeBtnText}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar hidden={!chromeVisible} animated />

      {/* Tappable image area */}
      <Pressable style={styles.imageArea} onPress={toggleChrome}>
        <Animated.View style={[styles.imageWrap, imageStyle]}>
          <Image
            source={{ uri }}
            style={styles.image}
            contentFit="contain"
            transition={150}
            cachePolicy="memory-disk"
          />
        </Animated.View>
      </Pressable>

      {/* Top bar */}
      {chromeVisible && (
        <View style={[styles.topBar, { paddingTop: insets.top + SPACING.xs }]}>
          <Pressable style={styles.iconBtn} onPress={handleClose}>
            <Ionicons name="close" size={22} color={C.text} />
          </Pressable>

          {title ? (
            <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <Pressable style={styles.iconBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color={C.text} />
          </Pressable>
        </View>
      )}

      {/* Bottom bar */}
      {chromeVisible && title && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
          <Text style={styles.captionText}>{title}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: "#000",
  },
  center: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    gap:            SPACING.sm,
    backgroundColor: "#000",
  },
  errorText:    { color: C.textMuted, fontSize: FONT_SIZE.base },
  closeBtn: {
    marginTop:         SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.sm,
    backgroundColor:   C.surface,
    borderRadius:      RADIUS.full,
  },
  closeBtnText: { color: C.text, fontSize: FONT_SIZE.base, fontWeight: "600" },

  imageArea: {
    position:       "absolute",
    top:            0,
    left:           0,
    right:          0,
    bottom:         0,
    alignItems:     "center",
    justifyContent: "center",
  },
  imageWrap: {
    width:  SW,
    height: SH,
  },
  image: {
    width:  "100%",
    height: "100%",
  },

  // Top chrome
  topBar: {
    position:          "absolute",
    top:               0,
    left:              0,
    right:             0,
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: SPACING.md,
    paddingBottom:     SPACING.sm,
    backgroundColor:   "rgba(0,0,0,0.55)",
  },
  iconBtn: {
    width:           40,
    height:          40,
    borderRadius:    RADIUS.full,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  titleText: {
    flex:       1,
    color:      C.text,
    fontSize:   FONT_SIZE.base,
    fontWeight: "600",
    textAlign:  "center",
    marginHorizontal: SPACING.sm,
  },

  // Bottom chrome
  bottomBar: {
    position:          "absolute",
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: SPACING.lg,
    paddingTop:        SPACING.md,
    backgroundColor:   "rgba(0,0,0,0.55)",
  },
  captionText: {
    color:      C.textSecondary,
    fontSize:   FONT_SIZE.sm,
    lineHeight: 20,
  },
});
