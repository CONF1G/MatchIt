import { memo, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Share, Modal, Pressable, Alert,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { COLORS, RADIUS, FONT_SIZE, SPACING } from "../../config/theme";
import { saveCatalog } from "../../services/social";

const C = COLORS;

export type FeedItemData = {
  id:          string;
  url:         string;
  title:       string | null;
  aspectRatio: number;
  catalogId:   string;
};

function MenuItem({
  icon, label, onPress,
}: { icon: any; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: C.surfaceHigh }]}
    >
      <Ionicons name={icon} size={20} color={C.text} />
      <Text style={styles.menuItemLabel}>{label}</Text>
    </Pressable>
  );
}

const FeedItem = memo(({ item }: { item: FeedItemData }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const close = () => setMenuOpen(false);

  const handleSaveCatalog = async () => {
    close();
    const { error } = await saveCatalog(item.catalogId);
    if (error) {
      Alert.alert("", error === "Not authenticated"
        ? "Sign in to save catalogs"
        : "Could not save catalog");
    } else {
      Alert.alert("Saved", "Catalog added to your saved list");
    }
  };

  const handleViewCatalog = () => {
    close();
    router.push(`/catalog/${item.catalogId}` as any);
  };

  const handleShare = async () => {
    close();
    await Share.share({
      message: `Check this out on MatchIt!\nmatchit://photo/${item.id}`,
    });
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => router.push(`/photo/${item.id}` as any)}
    >
      <Image
        source={{ uri: item.url }}
        style={[styles.image, { aspectRatio: item.aspectRatio || 1 }]}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
      />
      <View style={styles.footer}>
        {item.title ? (
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <TouchableOpacity
          onPress={() => setMenuOpen(true)}
          hitSlop={8}
          style={styles.menuBtn}
        >
          <Ionicons name="ellipsis-horizontal" size={16} color={C.textMuted} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <Pressable style={styles.overlay} onPress={close}>
          <Pressable style={styles.menuCard} onPress={() => {}}>
            <MenuItem
              icon="bookmark-outline"
              label="Save Catalog"
              onPress={handleSaveCatalog}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="albums-outline"
              label="View Catalog"
              onPress={handleViewCatalog}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="share-social-outline"
              label="Share"
              onPress={handleShare}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  image: {
    width:           "100%",
    borderRadius:    RADIUS.lg,
    backgroundColor: C.surface,
  },
  footer: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    paddingVertical:   4,
  },
  title: {
    flex:       1,
    color:      C.textSecondary,
    fontSize:   FONT_SIZE.xs,
    fontWeight: "600",
  },
  menuBtn: {
    padding: 2,
  },

  // ── Popup menu ──────────────────────────────────────────────────────────────
  overlay: {
    flex:            1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  menuCard: {
    backgroundColor: C.surface,
    borderRadius:    RADIUS.xl,
    width:           270,
    paddingVertical: SPACING.xs,
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 10 },
    shadowOpacity:   0.35,
    shadowRadius:    24,
    elevation:       12,
    overflow:        "hidden",
  },
  menuItem: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.md,
  },
  menuItemLabel: {
    color:      C.text,
    fontSize:   FONT_SIZE.base,
    fontWeight: "500",
  },
  menuDivider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginHorizontal: SPACING.md,
  },
});

export default FeedItem;
