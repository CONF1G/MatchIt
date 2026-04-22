// src/app/(modals)/create-catalog.tsx
// Modal pentru crearea unui catalog nou cu titlu, descriere, tags și poze.
// Demonstrează fluxul complet: formular → upload Storage → insert DB.

import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  Pressable, Image, Alert, ActivityIndicator,
  Switch, FlatList,
} from "react-native";
import { router } from "expo-router";
import { goBack } from "../../utils/navigation";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Input }   from "../../components/common/Input";
import { Button }  from "../../components/common/Button";
import { createCatalog }        from "../../services/catalog";
import { uploadCatalogPhoto }   from "../../services/storage";
import { addPhoto }             from "../../services/catalog";
import { useAuth }              from "../../hooks/useAuth";
import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../config/theme";

// ─── Tipuri locale ────────────────────────────────────────────────────────────

type LocalPhoto = {
  uri:    string;   // URI local (înainte de upload)
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
};

type FormErrors = {
  title?: string;
};

// ─── Componenta ───────────────────────────────────────────────────────────────

export default function CreateCatalogModal() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // ── State formular ─────────────────────────────────────────────────────────
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [tagInput,    setTagInput]     = useState("");
  const [tags,        setTags]         = useState<string[]>([]);
  const [isPrivate,   setIsPrivate]    = useState(false);
  const [photos,      setPhotos]       = useState<LocalPhoto[]>([]);
  const [errors,      setErrors]       = useState<FormErrors>({});
  const [submitting,  setSubmitting]   = useState(false);

  // ── Validare ───────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const e: FormErrors = {};
    if (title.trim().length < 2) e.title = "Titlul trebuie să aibă minim 2 caractere";
    if (title.trim().length > 60) e.title = "Titlul poate avea maxim 60 caractere";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Tag management ─────────────────────────────────────────────────────────
  const addTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, "_");
    if (!tag || tags.includes(tag) || tags.length >= 5) return;
    setTags((prev) => [...prev, tag]);
    setTagInput("");
  }, [tagInput, tags]);

  const removeTag = (tag: string) =>
    setTags((prev) => prev.filter((t) => t !== tag));

  // ── Selectare poze ─────────────────────────────────────────────────────────
  const handlePickPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permisiune necesară", "Avem nevoie de acces la galeria ta.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsMultipleSelection: true,
      quality: 1,
      selectionLimit: 20,
    });

    if (!result.canceled) {
      const newPhotos: LocalPhoto[] = result.assets.map((a) => ({
        uri: a.uri,
        status: "pending",
      }));
      setPhotos((prev) => [...prev, ...newPhotos].slice(0, 20)); // max 20
    }
  };

  const removeLocalPhoto = (uri: string) =>
    setPhotos((prev) => prev.filter((p) => p.uri !== uri));

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate() || !user) return;
    setSubmitting(true);

    try {
      // 1. Creăm catalogul în DB
      const { data: catalog, error: catalogError } = await createCatalog({
        title:       title.trim(),
        description: description.trim() || undefined,
        tags,
        is_private:  isPrivate,
      });

      if (catalogError || !catalog) {
        Alert.alert("Eroare", catalogError ?? "Nu s-a putut crea catalogul");
        setSubmitting(false);
        return;
      }

      // 2. Uploadăm fiecare poză și o adăugăm în DB
      if (photos.length > 0) {
        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i];

          // Actualizăm statusul pozei în UI
          setPhotos((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, status: "uploading" } : p
            )
          );

          // Upload în Storage
          const { data: uploadData, error: uploadError } =
            await uploadCatalogPhoto(photo.uri, user.id, catalog.id);

          if (uploadError || !uploadData) {
            setPhotos((prev) =>
              prev.map((p, idx) =>
                idx === i ? { ...p, status: "error", error: uploadError ?? undefined } : p
              )
            );
            continue; // continuăm cu poza următoare
          }

          // Insert în tabela photos
          await addPhoto({
            catalog_id:    catalog.id,
            storage_path:  uploadData.path,
            url:           uploadData.url,
            thumbnail_url: uploadData.thumbnailUrl,
            sort_order:    i,
          });

          setPhotos((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, status: "done" } : p
            )
          );
        }
      }

      // 3. Navigăm la catalogul nou creat
      router.replace(`/catalog/${catalog.id}`);

    } catch (e) {
      const msg = e instanceof Error ? e.message : "Eroare necunoscută";
      Alert.alert("Eroare", msg);
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>

      {/* Header modal */}
      <View style={styles.header}>
        <Pressable onPress={() => goBack()} style={styles.closeBtn} disabled={submitting}>
          <Ionicons name="close" size={22} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Catalog Nou</Text>
        <View style={{ width: 36 }} /> {/* Spacer pentru centrare */}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Titlu ── */}
        <Input
          label="Titlu *"
          placeholder="Ex: Arhitectură Urbană"
          value={title}
          onChangeText={(t) => { setTitle(t); setErrors((e) => ({ ...e, title: undefined })); }}
          leftIcon="albums-outline"
          error={errors.title}
          maxLength={60}
          showCharCount
          containerStyle={styles.field}
        />

        {/* ── Descriere ── */}
        <Input
          label="Descriere"
          placeholder="Despre ce e acest catalog?"
          value={description}
          onChangeText={setDescription}
          leftIcon="text-outline"
          maxLength={300}
          showCharCount
          multiline
          numberOfLines={3}
          containerStyle={styles.field}
          hint="Opțional — ajută alții să înțeleagă catalogul tău"
        />

        {/* ── Tags ── */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Tag-uri (max 5)</Text>

          {/* Input tag + buton Add */}
          <View style={styles.tagInputRow}>
            <Input
              placeholder="Ex: arhitectura"
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={addTag}
              returnKeyType="done"
              autoCapitalize="none"
              containerStyle={{ flex: 1 }}
            />
            <Pressable
              style={[styles.addTagBtn, (!tagInput.trim() || tags.length >= 5) && styles.addTagBtnDisabled]}
              onPress={addTag}
              disabled={!tagInput.trim() || tags.length >= 5}
            >
              <Ionicons name="add" size={20} color={COLORS.bg} />
            </Pressable>
          </View>

          {/* Lista de tag-uri adăugate */}
          {tags.length > 0 && (
            <View style={styles.tagsList}>
              {tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                  <Pressable onPress={() => removeTag(tag)} hitSlop={6}>
                    <Ionicons name="close" size={12} color={COLORS.accentDim} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Privat toggle ── */}
        <View style={[styles.field, styles.toggleRow]}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Catalog privat</Text>
            <Text style={styles.toggleSubtitle}>
              Doar tu îl poți vedea
            </Text>
          </View>
          <Switch
            value={isPrivate}
            onValueChange={setIsPrivate}
            trackColor={{ false: COLORS.border, true: COLORS.accent }}
            thumbColor={COLORS.bg}
          />
        </View>

        {/* ── Poze ── */}
        <View style={styles.field}>
          <View style={styles.photoHeader}>
            <Text style={styles.fieldLabel}>Poze ({photos.length}/20)</Text>
            <Pressable onPress={handlePickPhotos} disabled={photos.length >= 20 || submitting}>
              <Text style={[styles.addPhotosLink, photos.length >= 20 && { opacity: 0.4 }]}>
                + Adaugă
              </Text>
            </Pressable>
          </View>

          {photos.length === 0 ? (
            /* Zona de drop/pick goală */
            <Pressable style={styles.emptyPhotos} onPress={handlePickPhotos}>
              <Ionicons name="images-outline" size={32} color={COLORS.textMuted} />
              <Text style={styles.emptyPhotosText}>Apasă pentru a adăuga poze</Text>
              <Text style={styles.emptyPhotosSubtext}>JPEG, PNG • max 10MB per poză</Text>
            </Pressable>
          ) : (
            /* Grid poze selectate */
            <FlatList
              data={photos}
              keyExtractor={(item) => item.uri}
              numColumns={3}
              columnWrapperStyle={styles.photoRow}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.photoThumb}>
                  <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />

                  {/* Overlay status */}
                  {item.status === "uploading" && (
                    <View style={styles.photoOverlay}>
                      <ActivityIndicator size="small" color={COLORS.accent} />
                    </View>
                  )}
                  {item.status === "done" && (
                    <View style={[styles.photoOverlay, styles.photoOverlayDone]}>
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                    </View>
                  )}
                  {item.status === "error" && (
                    <View style={[styles.photoOverlay, styles.photoOverlayError]}>
                      <Ionicons name="close-circle" size={20} color={COLORS.danger} />
                    </View>
                  )}

                  {/* Buton remove — doar dacă nu se uploadează */}
                  {item.status !== "uploading" && !submitting && (
                    <Pressable
                      style={styles.removePhoto}
                      onPress={() => removeLocalPhoto(item.uri)}
                    >
                      <Ionicons name="close" size={12} color="#fff" />
                    </Pressable>
                  )}
                </View>
              )}
            />
          )}
        </View>
      </ScrollView>

      {/* ── Footer cu buton submit ── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.sm }]}>
        {submitting && (
          <Text style={styles.uploadingText}>
            Se uploadează pozele... Nu închide aplicația.
          </Text>
        )}
        <Button
          label={submitting ? "Se creează..." : "Creează Catalogul"}
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting || !title.trim()}
          fullWidth
          leftIcon={submitting ? undefined : "albums"}
        />
      </View>
    </View>
  );
}

// ─── Stiluri ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // Header
  header: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  closeBtn: {
    width: 36, height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: {
    color: COLORS.text, fontSize: FONT_SIZE.lg, fontWeight: "700",
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
    gap: SPACING.sm,
  },

  // Câmpuri
  field: { gap: SPACING.xs },
  fieldLabel: {
    color: COLORS.textSecondary, fontSize: FONT_SIZE.sm,
    fontWeight: "600", marginLeft: 2,
  },

  // Tags
  tagInputRow: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm,
  },
  addTagBtn: {
    width: 48, height: 48, borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent,
    alignItems: "center", justifyContent: "center",
    marginTop: 20,
  },
  addTagBtnDisabled: { opacity: 0.4 },
  tagsList: {
    flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs, marginTop: SPACING.xs,
  },
  tag: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.accentSubtle,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm + 2, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.borderAccent,
  },
  tagText: {
    color: COLORS.accent, fontSize: FONT_SIZE.xs, fontWeight: "600",
  },

  // Toggle
  toggleRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  toggleInfo: { flex: 1 },
  toggleLabel: { color: COLORS.text, fontSize: FONT_SIZE.base, fontWeight: "600" },
  toggleSubtitle: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },

  // Poze
  photoHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  addPhotosLink: {
    color: COLORS.accent, fontSize: FONT_SIZE.sm, fontWeight: "700",
  },
  emptyPhotos: {
    height: 120, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed",
    backgroundColor: COLORS.surface,
    alignItems: "center", justifyContent: "center", gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  emptyPhotosText: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, fontWeight: "600" },
  emptyPhotosSubtext: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },

  photoRow: { gap: 2, marginBottom: 2 },
  photoThumb: {
    flex: 1 / 3, aspectRatio: 1,
    backgroundColor: COLORS.surfaceHigh, overflow: "hidden",
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  photoOverlayDone:  { backgroundColor: "rgba(0,0,0,0.2)" },
  photoOverlayError: { backgroundColor: "rgba(255,92,92,0.3)" },
  removePhoto: {
    position: "absolute", top: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center", justifyContent: "center",
  },

  // Footer
  footer: {
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg, gap: SPACING.sm,
  },
  uploadingText: {
    color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: "center",
  },
});