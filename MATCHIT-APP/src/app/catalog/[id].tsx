import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList,
  Pressable, ActivityIndicator, Alert, Share, RefreshControl, Platform,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../hooks/useAuth";
import { fetchCatalogById, toggleCatalogLike, checkCatalogLike, deleteCatalog } from "../../services/catalog";
import { fetchPhotosByCatalog, deletePhoto } from "../../services/photo";
import { normalizeStorageUrl } from "../../services/storage";
import { checkCatalogSaved, saveCatalog, unsaveCatalog } from "../../services/social";
import { PhotoMosaic } from "../../components/catalog/CatalogThumb";
import { goBack } from "../../services/navigation";
import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../config/theme";

const C = COLORS;
const IS_WEB = Platform.OS === "web";

type Photo = {
  id:    string;
  url:   string;
  title?: string | null;
};

// ─── Photo tile ───────────────────────────────────────────────────────────────

function PhotoTile({
  photo,
  isOwner,
  onDelete,
}: {
  photo:    Photo;
  isOwner:  boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}
      onPress={() => router.push(`/photo/${photo.id}` as any)}
      onLongPress={() => {
        if (!isOwner) return;
        Alert.alert("Delete photo?", photo.title ?? "This photo will be removed.", [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => onDelete(photo.id) },
        ]);
      }}
    >
      <Image
        source={{ uri: photo.url }}
        style={styles.tileImg}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
      />
      {photo.title ? (
        <View style={styles.tileOverlay}>
          <Text style={styles.tileTitle} numberOfLines={1}>{photo.title}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CatalogScreen() {
  const insets = useSafeAreaInsets();
  const { id }  = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [catalog,     setCatalog]    = useState<any>(null);
  const [photos,      setPhotos]     = useState<Photo[]>([]);
  const [liked,       setLiked]      = useState(false);
  const [likeCount,   setLikeCount]  = useState(0);
  const [saved,       setSaved]      = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [loading,     setLoading]    = useState(true);
  const [refreshing,  setRefreshing] = useState(false);

  const isOwner = user?.id === catalog?.owner_id;

  const load = useCallback(async () => {
    if (!id) return;
    const [catRes, photosRes, likeRes, isSaved] = await Promise.all([
      fetchCatalogById(id),
      fetchPhotosByCatalog(id),
      user
        ? checkCatalogLike(id)
        : Promise.resolve({ data: { isLiked: false }, error: null }),
      user ? checkCatalogSaved(id) : Promise.resolve(false),
    ]);

    if (catRes.data)    { setCatalog(catRes.data); setLikeCount(catRes.data.likes_count ?? 0); }
    if (photosRes.data) setPhotos(
      (photosRes.data as Photo[]).map((p) => ({ ...p, url: normalizeStorageUrl(p.url) ?? p.url }))
    );
    if (likeRes.data)   setLiked(likeRes.data.isLiked);
    setSaved(isSaved);

    setLoading(false);
    setRefreshing(false);
  }, [id, user]);

  const handleSave = async () => {
    if (!user) return;
    setSaveLoading(true);
    if (saved) {
      setSaved(false);
      const { error } = await unsaveCatalog(id);
      if (error) setSaved(true);
    } else {
      setSaved(true);
      const { error } = await saveCatalog(id);
      if (error) setSaved(false);
    }
    setSaveLoading(false);
  };

  useEffect(() => { load(); }, [load]);

  const handleLike = async () => {
    if (!user) {
      Alert.alert("Sign in required", "You need an account to like catalogs.");
      return;
    }
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    await toggleCatalogLike(id);
  };

  const handleShare = async () => {
    if (!catalog) return;
    try {
      await Share.share({
        message: `Check out "${catalog.title}" on MatchIt!\nmatchit://catalog/${id}`,
      });
    } catch { /* ignore */ }
  };

  const handleDeletePhoto = async (photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    const { error } = await deletePhoto(photoId);
    if (error) {
      Alert.alert("Error", "Could not delete photo.");
      load();
    }
  };

  const handleDeleteCatalog = () => {
    Alert.alert(
      "Delete Catalog",
      "This will permanently delete the catalog and all its photos.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error } = await deleteCatalog(id);
            if (error) {
              Alert.alert("Error", error);
            } else {
              goBack();
            }
          },
        },
      ]
    );
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  if (!catalog) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={44} color={C.textMuted} />
        <Text style={styles.notFoundText}>Catalog not found</Text>
        <Pressable style={styles.backPill} onPress={() => goBack()}>
          <Text style={styles.backPillText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const owner = catalog.profiles;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Floating header — positioned below the status bar */}
      <View style={[styles.header, { top: insets.top }]}>
        <Pressable style={styles.floatBtn} onPress={() => goBack()}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable style={styles.floatBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color={C.text} />
          </Pressable>
          {user && !isOwner && (
            <Pressable
              style={styles.floatBtn}
              onPress={handleSave}
              disabled={saveLoading}
            >
              <Ionicons
                name={saved ? "bookmark" : "bookmark-outline"}
                size={20}
                color={saved ? C.accent : C.text}
              />
            </Pressable>
          )}
          {isOwner && (
            <>
              <Pressable
                style={styles.floatBtn}
                onPress={() => router.push(`/catalog/edit?id=${id}` as any)}
              >
                <Ionicons name="create-outline" size={20} color={C.text} />
              </Pressable>
              <Pressable style={styles.floatBtn} onPress={handleDeleteCatalog}>
                <Ionicons name="trash-outline" size={18} color={C.danger} />
              </Pressable>
            </>
          )}
        </View>
      </View>

      <FlatList
        data={photos}
        keyExtractor={(item) => item.id}
        numColumns={3}
        columnWrapperStyle={{ gap: 2 }}
        style={IS_WEB ? styles.flatListWeb : undefined}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={C.accent}
          />
        }
        ListHeaderComponent={
          <>
            {/* Cover */}
            {catalog.cover_url ? (
              <Image
                source={{ uri: normalizeStorageUrl(catalog.cover_url) ?? catalog.cover_url }}
                style={styles.cover}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.cover, styles.coverFallback]}>
                {photos.length > 0
                  ? <PhotoMosaic photos={photos.slice(0, 4).map(p => p.url)} />
                  : <Ionicons name="albums" size={44} color={C.textMuted} />
                }
              </View>
            )}

            {/* Meta section */}
            <View style={styles.meta}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={2}>{catalog.title}</Text>
                {catalog.is_private && (
                  <View style={styles.privatePill}>
                    <Ionicons name="lock-closed" size={10} color={C.textMuted} />
                    <Text style={styles.privatePillText}>Private</Text>
                  </View>
                )}
              </View>

              {catalog.description ? (
                <Text style={styles.description}>{catalog.description}</Text>
              ) : null}

              {owner && (
                <Pressable
                  style={styles.ownerRow}
                  onPress={() => router.push(`/user/${catalog.owner_id}` as any)}
                >
                  <View style={styles.ownerAvatar}>
                    {owner.avatar_url ? (
                      <Image
                        source={{ uri: owner.avatar_url }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                      />
                    ) : (
                      <Text style={styles.ownerInitials}>
                        {owner.username?.slice(0, 2).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.ownerName}>@{owner.username}</Text>
                </Pressable>
              )}

              {/* Stats + actions */}
              <View style={styles.statsRow}>
                <View style={styles.pill}>
                  <Ionicons name="images-outline" size={13} color={C.textMuted} />
                  <Text style={styles.pillText}>{photos.length}</Text>
                </View>

                <Pressable style={styles.pill} onPress={handleLike}>
                  <Ionicons
                    name={liked ? "heart" : "heart-outline"}
                    size={13}
                    color={liked ? C.danger : C.textMuted}
                  />
                  <Text style={[styles.pillText, liked && { color: C.danger }]}>
                    {likeCount}
                  </Text>
                </Pressable>

                {isOwner && (
                  <Pressable
                    style={styles.accentPill}
                    onPress={() =>
                      router.push({ pathname: "/post", params: { catalogId: id } } as any)
                    }
                  >
                    <Ionicons name="add" size={15} color={C.bg} />
                    <Text style={styles.accentPillText}>Add Photos</Text>
                  </Pressable>
                )}
              </View>

              {catalog.tags?.length > 0 && (
                <View style={styles.tagsRow}>
                  {(catalog.tags as string[]).map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.divider} />
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyPhotos}>
            <Ionicons name="camera-outline" size={40} color={C.textMuted} />
            <Text style={styles.emptyPhotosText}>No photos yet</Text>
            {isOwner && (
              <Pressable
                style={styles.accentPill}
                onPress={() =>
                  router.push({ pathname: "/post", params: { catalogId: id } } as any)
                }
              >
                <Ionicons name="add" size={15} color={C.bg} />
                <Text style={styles.accentPillText}>Add Photos</Text>
              </Pressable>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <PhotoTile photo={item} isOwner={isOwner} onDelete={handleDeletePhoto} />
        )}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  flatListWeb: { maxWidth: 800, alignSelf: "center" as const, width: "100%" as any },
  center: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    gap:            SPACING.sm,
    backgroundColor: C.bg,
  },
  notFoundText: { color: C.textMuted, fontSize: FONT_SIZE.lg },

  // Floating header
  header: {
    position:          "absolute",
    top:               0,
    left:              0,
    right:             0,
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    zIndex:            10,
  },
  headerRight:  { flexDirection: "row", gap: SPACING.sm },
  floatBtn: {
    width:           38,
    height:          38,
    borderRadius:    RADIUS.full,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems:      "center",
    justifyContent:  "center",
  },

  // Cover
  cover: { width: "100%", height: 220 },
  coverFallback: {
    backgroundColor: C.surface,
    alignItems:      "center",
    justifyContent:  "center",
  },

  // Meta
  meta: {
    paddingHorizontal: SPACING.lg,
    paddingTop:        SPACING.lg,
    paddingBottom:     SPACING.md,
    gap:               SPACING.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems:    "flex-start",
    gap:           SPACING.sm,
  },
  title: {
    flex:       1,
    color:      C.text,
    fontSize:   FONT_SIZE.xxl,
    fontWeight: "800",
    lineHeight: 28,
  },
  privatePill: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               3,
    backgroundColor:   C.surface,
    borderRadius:      RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   3,
    borderWidth:       1,
    borderColor:       C.border,
    marginTop:         4,
  },
  privatePillText: { color: C.textMuted, fontSize: 10, fontWeight: "600" },

  description: {
    color:      C.textSecondary,
    fontSize:   FONT_SIZE.base,
    lineHeight: 22,
  },

  ownerRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           SPACING.sm,
  },
  ownerAvatar: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: C.accentDim,
    overflow:        "hidden",
    alignItems:      "center",
    justifyContent:  "center",
  },
  ownerInitials: { color: C.bg, fontSize: 11, fontWeight: "800" },
  ownerName:     { color: C.textMuted, fontSize: FONT_SIZE.sm, fontWeight: "600" },

  statsRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           SPACING.sm,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems:    "center",
    flexWrap:      "wrap",
    gap:           SPACING.sm,
  },
  pill: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               4,
    backgroundColor:   C.surface,
    borderRadius:      RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.xs,
    borderWidth:       1,
    borderColor:       C.border,
  },
  pillText: { color: C.textMuted, fontSize: FONT_SIZE.sm, fontWeight: "600" },

  accentPill: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               4,
    backgroundColor:   C.accent,
    borderRadius:      RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.xs,
  },
  accentPillText: { color: C.bg, fontSize: FONT_SIZE.sm, fontWeight: "800" },

  tagsRow: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           SPACING.xs,
  },
  tag: {
    backgroundColor:   C.accentSubtle,
    borderRadius:      RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   3,
    borderWidth:       1,
    borderColor:       C.borderAccent,
  },
  tagText: { color: C.accent, fontSize: FONT_SIZE.xs, fontWeight: "600" },

  divider: {
    height:          1,
    backgroundColor: C.border,
    marginBottom:    2,
  },

  // Photo grid
  tile: {
    flex:            1,
    aspectRatio:     1,
    backgroundColor: C.surface,
    overflow:        "hidden",
  },
  tileImg: { width: "100%", height: "100%" },
  tileOverlay: {
    position:          "absolute",
    bottom:            0,
    left:              0,
    right:             0,
    backgroundColor:   "rgba(0,0,0,0.55)",
    paddingHorizontal: SPACING.xs,
    paddingVertical:   SPACING.xs,
  },
  tileTitle: { color: C.text, fontSize: 10, fontWeight: "600" },

  emptyPhotos: {
    alignItems:        "center",
    paddingVertical:   SPACING.xxl,
    gap:               SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  emptyPhotosText: { color: C.textMuted, fontSize: FONT_SIZE.base },

  backPill: {
    marginTop:         SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.sm,
    backgroundColor:   C.surface,
    borderRadius:      RADIUS.full,
    borderWidth:       1,
    borderColor:       C.border,
  },
  backPillText: { color: C.text, fontSize: FONT_SIZE.base, fontWeight: "600" },
});
