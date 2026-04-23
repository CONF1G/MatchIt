import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  FlatList, TextInput, Alert, ActivityIndicator, Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../hooks/useAuth";
import { fetchUserCatalogs } from "../services/catalog";
import { createPhoto } from "../services/photo";
import { goBack } from "../utils/navigation";
import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../config/theme";

const C = COLORS;

// ─── Types ────────────────────────────────────────────────────────────────────

type PickedAsset = {
  uri:    string;
  width:  number;
  height: number;
  fileName?: string;
};

type UploadStatus = "idle" | "uploading" | "done" | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function splitTags(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, "").toLowerCase().trim())
    .filter(Boolean);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PhotoThumbnail({
  uri,
  onRemove,
  status,
}: {
  uri:      string;
  onRemove: () => void;
  status:   UploadStatus;
}) {
  return (
    <View style={thumb.wrap}>
      <Image source={{ uri }} style={thumb.img} contentFit="cover" />

      {/* upload overlay */}
      {status === "uploading" && (
        <View style={thumb.overlay}>
          <ActivityIndicator size="small" color={C.accent} />
        </View>
      )}
      {status === "done" && (
        <View style={[thumb.overlay, { backgroundColor: C.success + "99" }]}>
          <Ionicons name="checkmark" size={18} color="#fff" />
        </View>
      )}
      {status === "error" && (
        <View style={[thumb.overlay, { backgroundColor: C.danger + "99" }]}>
          <Ionicons name="close" size={18} color="#fff" />
        </View>
      )}

      {/* remove button (only when idle) */}
      {status === "idle" && (
        <Pressable style={thumb.remove} onPress={onRemove} hitSlop={6}>
          <Ionicons name="close-circle" size={20} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

const thumb = StyleSheet.create({
  wrap: {
    width:        "31%",
    aspectRatio:  1,
    borderRadius: RADIUS.md,
    overflow:     "hidden",
    backgroundColor: C.surface,
    margin:       "1%",
  },
  img:     { width: "100%", height: "100%" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  remove: {
    position:     "absolute",
    top:          4,
    right:        4,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PostScreen() {
  const insets          = useSafeAreaInsets();
  const { user }        = useAuth();

  const [assets,        setAssets]        = useState<PickedAsset[]>([]);
  const [catalogs,      setCatalogs]      = useState<any[]>([]);
  const [catalogId,     setCatalogId]     = useState<string | null>(null);
  const [caption,       setCaption]       = useState("");
  const [tagInput,      setTagInput]      = useState("");
  const [tags,          setTags]          = useState<string[]>([]);
  const [statuses,      setStatuses]      = useState<UploadStatus[]>([]);
  const [uploadErrors,  setUploadErrors]  = useState<(string | null)[]>([]);
  const [uploading,     setUploading]     = useState(false);
  const [doneCount,     setDoneCount]     = useState(0);
  const [loadingCats,   setLoadingCats]   = useState(true);

  // ── Load user's catalogs ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await fetchUserCatalogs(user.id, true);
      setCatalogs(data ?? []);
      if (data && data.length > 0) setCatalogId(data[0].id);
      setLoadingCats(false);
    })();
  }, [user]);

  // ── Pick photos ───────────────────────────────────────────────────────────
  const handlePick = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photo library to upload photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsMultipleSelection: Platform.OS !== "web", // web doesn't support multi-select
      quality:    1,
      selectionLimit: 10,
    });

    if (result.canceled) return;

    const newAssets = result.assets.map((a) => ({
      uri:      a.uri,
      width:    a.width,
      height:   a.height,
      fileName: a.fileName ?? undefined,
    }));

    setAssets((prev) => {
      const merged = [...prev, ...newAssets].slice(0, 10); // max 10
      setStatuses(merged.map(() => "idle"));
      setUploadErrors(merged.map(() => null));
      return merged;
    });
  }, []);

  const removeAsset = useCallback((index: number) => {
    setAssets((prev) => prev.filter((_, i) => i !== index));
    setStatuses((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Tag management ────────────────────────────────────────────────────────
  const commitTag = () => {
    const parsed = splitTags(tagInput);
    if (!parsed.length) { setTagInput(""); return; }
    // Use functional update so both onSubmitEditing + onBlur firing together
    // always read the latest state and never produce duplicates.
    setTags((prev) => {
      const added = parsed.filter((t) => !prev.includes(t));
      return added.length ? [...prev, ...added] : prev;
    });
    setTagInput("");
  };

  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag));

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!catalogId) {
      Alert.alert("No catalog selected", "Please select a catalog first.");
      return;
    }
    if (assets.length === 0) {
      Alert.alert("No photos selected", "Add at least one photo.");
      return;
    }

    setUploading(true);
    setDoneCount(0);

    let successCount = 0;
    const allTags = [...tags, ...splitTags(tagInput)];
    const errors: (string | null)[] = assets.map(() => null);

    for (let i = 0; i < assets.length; i++) {
      setStatuses((prev) => prev.map((s, idx) => idx === i ? "uploading" : s));

      const { error } = await createPhoto({
        localUri:    assets[i].uri,
        catalogId,
        title:       caption.trim() || undefined,
        tags:        allTags,
        sortOrder:   i,
      });

      errors[i] = error;
      setStatuses((prev) =>
        prev.map((s, idx) => idx === i ? (error ? "error" : "done") : s)
      );
      setUploadErrors([...errors]);

      if (!error) {
        successCount++;
        setDoneCount(successCount);
      }
    }

    setUploading(false);

    if (successCount === assets.length) {
      setTimeout(() => {
        router.replace({ pathname: "/catalog/[id]", params: { id: catalogId } });
      }, 800);
    } else {
      const firstError = errors.find(Boolean);
      Alert.alert(
        `${successCount}/${assets.length} uploaded`,
        firstError ?? "Some photos failed. Check your connection and try again.",
      );
    }
  };

  const canUpload = assets.length > 0 && !!catalogId && !uploading;
  const progress  = assets.length > 0 ? doneCount / assets.length : 0;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable onPress={() => goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Add Photos</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + 100 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Section: Photos ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <Text style={styles.sectionMeta}>{assets.length}/10</Text>
          </View>

          <View style={styles.photoGrid}>
            {assets.map((asset, i) => (
              <PhotoThumbnail
                key={asset.uri}
                uri={asset.uri}
                status={statuses[i] ?? "idle"}
                onRemove={() => removeAsset(i)}
              />
            ))}

            {assets.length < 10 && (
              <Pressable
                style={({ pressed }) => [styles.addPhotoBtn, pressed && { opacity: 0.7 }]}
                onPress={handlePick}
              >
                <Ionicons name="add" size={28} color={C.accent} />
                <Text style={styles.addPhotoText}>
                  {assets.length === 0 ? "Select Photos" : "Add More"}
                </Text>
              </Pressable>
            )}
          </View>

          {assets.length === 0 && (
            <Text style={styles.hint}>Up to 10 photos per upload.</Text>
          )}
        </View>

        {/* ── Section: Catalog ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Target Catalog</Text>

          {loadingCats ? (
            <ActivityIndicator color={C.accent} style={{ marginTop: SPACING.sm }} />
          ) : catalogs.length === 0 ? (
            <View style={styles.emptyCatalogs}>
              <Ionicons name="albums-outline" size={24} color={C.textMuted} />
              <Text style={styles.emptyCatalogsText}>No catalogs yet.</Text>
              <Pressable
                onPress={() => router.push("/(modals)/create-catalog" as any)}
                style={styles.createCatalogBtn}
              >
                <Text style={styles.createCatalogBtnText}>Create a catalog first</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catalogScroll}
            >
              {catalogs.map((cat) => {
                const selected = cat.id === catalogId;
                return (
                  <Pressable
                    key={cat.id}
                    style={[styles.catalogChip, selected && styles.catalogChipSelected]}
                    onPress={() => setCatalogId(cat.id)}
                  >
                    {cat.cover_image ? (
                      <Image
                        source={{ uri: cat.cover_image }}
                        style={styles.catalogChipThumb}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.catalogChipThumb, { backgroundColor: C.surfaceHigh, alignItems: "center", justifyContent: "center" }]}>
                        <Ionicons name="albums" size={14} color={C.textMuted} />
                      </View>
                    )}
                    <Text
                      style={[styles.catalogChipLabel, selected && styles.catalogChipLabelSelected]}
                      numberOfLines={1}
                    >
                      {cat.title}
                    </Text>
                    {selected && (
                      <Ionicons name="checkmark-circle" size={14} color={C.accent} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* ── Section: Caption ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Caption <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={styles.captionInput}
            value={caption}
            onChangeText={setCaption}
            placeholder="Add a caption for all photos…"
            placeholderTextColor={C.textMuted}
            multiline
            maxLength={200}
            returnKeyType="done"
          />
          {caption.length > 0 && (
            <Text style={styles.charCount}>{caption.length}/200</Text>
          )}
        </View>

        {/* ── Section: Tags ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tags <Text style={styles.optional}>(optional)</Text></Text>

          {tags.length > 0 && (
            <View style={styles.tagRow}>
              {tags.map((tag, i) => (
                <Pressable
                  key={`${tag}-${i}`}
                  style={styles.tagChip}
                  onPress={() => removeTag(tag)}
                >
                  <Text style={styles.tagChipText}>#{tag}</Text>
                  <Ionicons name="close" size={12} color={C.accent} />
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.tagInputRow}>
            <TextInput
              style={styles.tagInput}
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="travel, food, design…"
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={commitTag}
              onBlur={commitTag}
            />
            <Pressable style={styles.tagAddBtn} onPress={commitTag}>
              <Ionicons name="add" size={18} color={C.bg} />
            </Pressable>
          </View>
          <Text style={styles.hint}>Separate tags with space or comma.</Text>
        </View>

      </ScrollView>

      {/* ── Footer: Upload / Progress ── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.sm }]}>

        {uploading ? (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <Text style={styles.progressText}>
              Uploading {doneCount}/{assets.length}…
            </Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.uploadBtn,
              !canUpload && styles.uploadBtnDisabled,
              pressed && canUpload && { opacity: 0.85 },
            ]}
            onPress={handleUpload}
            disabled={!canUpload}
          >
            <Ionicons name="cloud-upload-outline" size={20} color={C.bg} />
            <Text style={styles.uploadBtnText}>
              {assets.length === 0
                ? "Select photos first"
                : `Upload ${assets.length} Photo${assets.length > 1 ? "s" : ""}`}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width:           36,
    height:          36,
    borderRadius:    RADIUS.full,
    backgroundColor: C.surface,
    alignItems:      "center",
    justifyContent:  "center",
  },
  headerTitle: {
    color:      C.text,
    fontSize:   FONT_SIZE.lg,
    fontWeight: "700",
  },

  body: {
    paddingHorizontal: SPACING.lg,
    paddingTop:        SPACING.lg,
    gap:               SPACING.xl,
  },

  section: { gap: SPACING.sm },

  sectionHeader: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color:         C.text,
    fontSize:      FONT_SIZE.sm,
    fontWeight:    "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sectionMeta: {
    color:    C.textMuted,
    fontSize: FONT_SIZE.sm,
  },
  optional: {
    color:      C.textMuted,
    fontWeight: "400",
    fontSize:   FONT_SIZE.xs,
    textTransform: "none",
    letterSpacing: 0,
  },

  // Photo grid
  photoGrid: {
    flexDirection: "row",
    flexWrap:      "wrap",
  },
  addPhotoBtn: {
    width:           "31%",
    aspectRatio:     1,
    borderRadius:    RADIUS.md,
    borderWidth:     1.5,
    borderColor:     C.borderAccent,
    borderStyle:     "dashed",
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: C.accentSubtle,
    margin:          "1%",
    gap:             SPACING.xs,
  },
  addPhotoText: {
    color:    C.accent,
    fontSize: FONT_SIZE.xs,
    fontWeight: "600",
  },
  hint: {
    color:    C.textMuted,
    fontSize: FONT_SIZE.xs,
  },

  // Catalog
  emptyCatalogs: {
    alignItems:      "center",
    paddingVertical: SPACING.lg,
    gap:             SPACING.sm,
    backgroundColor: C.surface,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     C.border,
  },
  emptyCatalogsText: {
    color:    C.textMuted,
    fontSize: FONT_SIZE.sm,
  },
  createCatalogBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.xs,
    borderRadius:      RADIUS.full,
    backgroundColor:   C.accentSubtle,
    borderWidth:       1,
    borderColor:       C.borderAccent,
  },
  createCatalogBtnText: {
    color:      C.accent,
    fontSize:   FONT_SIZE.sm,
    fontWeight: "700",
  },
  catalogScroll: { gap: SPACING.sm, paddingVertical: 2 },
  catalogChip: {
    flexDirection:    "row",
    alignItems:       "center",
    gap:              SPACING.xs,
    backgroundColor:  C.surface,
    borderRadius:     RADIUS.full,
    borderWidth:      1,
    borderColor:      C.border,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.xs,
  },
  catalogChipSelected: {
    borderColor:     C.accent,
    backgroundColor: C.accentSubtle,
  },
  catalogChipThumb: {
    width:        20,
    height:       20,
    borderRadius: 4,
    overflow:     "hidden",
  },
  catalogChipLabel: {
    color:     C.textSecondary,
    fontSize:  FONT_SIZE.sm,
    maxWidth:  120,
  },
  catalogChipLabelSelected: {
    color:      C.accent,
    fontWeight: "700",
  },

  // Caption
  captionInput: {
    backgroundColor:   C.surface,
    borderRadius:      RADIUS.md,
    borderWidth:       1,
    borderColor:       C.border,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm + 4,
    color:             C.text,
    fontSize:          FONT_SIZE.base,
    minHeight:         80,
    textAlignVertical: "top",
  },
  charCount: {
    alignSelf: "flex-end",
    color:     C.textMuted,
    fontSize:  FONT_SIZE.xs,
  },

  // Tags
  tagRow: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           SPACING.xs,
  },
  tagChip: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               4,
    backgroundColor:   C.accentSubtle,
    borderRadius:      RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       C.borderAccent,
  },
  tagChipText: {
    color:    C.accent,
    fontSize: FONT_SIZE.xs,
    fontWeight: "600",
  },
  tagInputRow: {
    flexDirection: "row",
    gap:           SPACING.sm,
  },
  tagInput: {
    flex:              1,
    height:            44,
    backgroundColor:   C.surface,
    borderRadius:      RADIUS.md,
    borderWidth:       1,
    borderColor:       C.border,
    paddingHorizontal: SPACING.md,
    color:             C.text,
    fontSize:          FONT_SIZE.base,
  },
  tagAddBtn: {
    width:           44,
    height:          44,
    borderRadius:    RADIUS.md,
    backgroundColor: C.accent,
    alignItems:      "center",
    justifyContent:  "center",
  },

  // Footer
  footer: {
    position:        "absolute",
    bottom:          0,
    left:            0,
    right:           0,
    paddingHorizontal: SPACING.lg,
    paddingTop:      SPACING.md,
    backgroundColor: C.bg,
    borderTopWidth:  1,
    borderTopColor:  C.border,
  },
  uploadBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             SPACING.sm,
    backgroundColor: C.accent,
    borderRadius:    RADIUS.md,
    paddingVertical: SPACING.md,
  },
  uploadBtnDisabled: { opacity: 0.4 },
  uploadBtnText: {
    color:      C.bg,
    fontSize:   FONT_SIZE.lg,
    fontWeight: "800",
  },

  // Progress
  progressContainer: { gap: SPACING.xs },
  progressTrack: {
    height:          6,
    backgroundColor: C.surface,
    borderRadius:    RADIUS.full,
    overflow:        "hidden",
  },
  progressFill: {
    height:          6,
    backgroundColor: C.accent,
    borderRadius:    RADIUS.full,
  },
  progressText: {
    color:     C.textMuted,
    fontSize:  FONT_SIZE.sm,
    textAlign: "center",
  },
});
