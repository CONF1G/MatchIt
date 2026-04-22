import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  Pressable, Alert, ActivityIndicator, Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchCatalogById, updateCatalog, deleteCatalog } from "../../services/catalog";
import { Input }  from "../../components/common/Input";
import { Button } from "../../components/common/Button";
import { goBack } from "../../utils/navigation";
import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../config/theme";

const C = COLORS;

export default function CatalogEditScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput,   setTagsInput]   = useState("");
  const [isPrivate,   setIsPrivate]   = useState(false);

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await fetchCatalogById(id);
      if (data) {
        setTitle(data.title ?? "");
        setDescription(data.description ?? "");
        setTagsInput((data.tags ?? []).join(", "));
        setIsPrivate(data.is_private ?? false);
      }
      setLoading(false);
    })();
  }, [id]);

  const parseTags = (raw: string) =>
    raw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Title is required.");
      return;
    }
    setSaving(true);
    const { error } = await updateCatalog(id, {
      title:       title.trim(),
      description: description.trim() || null,
      tags:        parseTags(tagsInput),
      is_private:  isPrivate,
    });
    setSaving(false);

    if (error) {
      Alert.alert("Error", error);
    } else {
      goBack();
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Catalog",
      "This will permanently delete the catalog and all its photos. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            const { error } = await deleteCatalog(id);
            setDeleting(false);
            if (error) {
              Alert.alert("Error", error);
            } else {
              // Go back two levels: edit → catalog → home
              if (router.canGoBack()) router.back();
              if (router.canGoBack()) router.back();
              else router.replace("/(tabs)" as any);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={() => goBack()}>
          <Ionicons name="close" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Catalog</Text>
        <Pressable style={styles.headerBtn} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator size="small" color={C.accent} />
            : <Ionicons name="checkmark" size={22} color={C.accent} />
          }
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Input
          label="Title"
          placeholder="Catalog name"
          value={title}
          onChangeText={setTitle}
          leftIcon="albums-outline"
          maxLength={60}
          showCharCount
          containerStyle={{ marginBottom: SPACING.md }}
        />

        <Input
          label="Description"
          placeholder="Describe this catalog…"
          value={description}
          onChangeText={setDescription}
          leftIcon="document-text-outline"
          maxLength={300}
          showCharCount
          multiline
          numberOfLines={3}
          containerStyle={{ marginBottom: SPACING.md }}
        />

        <Input
          label="Tags"
          placeholder="nature, travel, food"
          value={tagsInput}
          onChangeText={setTagsInput}
          leftIcon="pricetag-outline"
          hint="Comma-separated"
          autoCapitalize="none"
          containerStyle={{ marginBottom: SPACING.lg }}
        />

        {/* Visibility toggle */}
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons
              name={isPrivate ? "lock-closed-outline" : "globe-outline"}
              size={18}
              color={C.textSecondary}
            />
            <View>
              <Text style={styles.rowLabel}>Private</Text>
              <Text style={styles.rowHint}>
                {isPrivate ? "Only you can see this" : "Visible to everyone"}
              </Text>
            </View>
          </View>
          <Switch
            value={isPrivate}
            onValueChange={setIsPrivate}
            trackColor={{ false: C.border, true: C.accentDim }}
            thumbColor={isPrivate ? C.accent : C.textMuted}
          />
        </View>

        <View style={styles.divider} />

        <Button
          label={saving ? "Saving…" : "Save Changes"}
          onPress={handleSave}
          loading={saving}
          style={{ marginBottom: SPACING.md }}
        />

        {/* Danger zone */}
        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          <Text style={styles.dangerHint}>
            Deleting a catalog is permanent. All photos inside will also be removed.
          </Text>
          <Pressable
            style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
            onPress={handleDelete}
            disabled={deleting}
          >
            {deleting
              ? <ActivityIndicator size="small" color={C.danger} />
              : <Ionicons name="trash-outline" size={16} color={C.danger} />
            }
            <Text style={styles.deleteBtnText}>
              {deleting ? "Deleting…" : "Delete Catalog"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: C.bg },
  center:  { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },

  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  headerBtn: {
    width:           40,
    height:          40,
    borderRadius:    RADIUS.full,
    alignItems:      "center",
    justifyContent:  "center",
  },
  headerTitle: {
    color:      C.text,
    fontSize:   FONT_SIZE.lg,
    fontWeight: "700",
  },

  content: {
    padding: SPACING.lg,
    gap:     SPACING.sm,
  },

  row: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
    backgroundColor: C.surface,
    borderRadius:    RADIUS.lg,
    padding:         SPACING.md,
    borderWidth:     1,
    borderColor:     C.border,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           SPACING.md,
  },
  rowLabel: {
    color:      C.text,
    fontSize:   FONT_SIZE.base,
    fontWeight: "600",
  },
  rowHint: {
    color:    C.textMuted,
    fontSize: FONT_SIZE.sm,
    marginTop: 1,
  },

  divider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginVertical:  SPACING.md,
  },

  dangerCard: {
    backgroundColor: C.dangerSubtle,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     C.danger + "40",
    padding:         SPACING.lg,
    gap:             SPACING.sm,
  },
  dangerTitle: {
    color:      C.danger,
    fontSize:   FONT_SIZE.base,
    fontWeight: "700",
  },
  dangerHint: {
    color:    C.textSecondary,
    fontSize: FONT_SIZE.sm,
    lineHeight: 18,
  },
  deleteBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    gap:               SPACING.sm,
    borderWidth:       1,
    borderColor:       C.danger,
    borderRadius:      RADIUS.md,
    paddingVertical:   SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginTop:         SPACING.xs,
  },
  deleteBtnText: {
    color:      C.danger,
    fontSize:   FONT_SIZE.base,
    fontWeight: "700",
  },
});
