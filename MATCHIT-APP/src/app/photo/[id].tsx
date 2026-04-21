// src/app/photo/[id].tsx
// Ecranul unei poze individuale.
// Funcționalități: vizualizare, editare titlu/descriere/tags, ștergere, like, comentarii.

import { useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image,
  Pressable, TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Switch, FlatList,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePhoto }  from "../../hooks/usePhoto";
import { Button }    from "../../components/common/Button";
import { Input }     from "../../components/common/Input";
import { COLORS, SPACING, RADIUS, FONT_SIZE } from "../../config/theme";

// ─── Sub-componente ───────────────────────────────────────────────────────────

/**
 * Render a tag as a pill, showing a close icon that calls `onRemove` when `isOwner` is true.
 *
 * @param tag - The tag text to display (without the leading `#`).
 * @param isOwner - Whether the current user has ownership and can remove the tag.
 * @param onRemove - Callback invoked when the remove icon is pressed.
 * @returns The rendered tag pill element.
 */
function TagPill({
  tag, isOwner, onRemove,
}: { tag: string; isOwner: boolean; onRemove: () => void }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>#{tag}</Text>
      {isOwner && (
        <Pressable onPress={onRemove} hitSlop={6}>
          <Ionicons name="close" size={11} color={COLORS.accentDim} />
        </Pressable>
      )}
    </View>
  );
}

/**
 * Renders a single comment row showing an avatar-like initial, username, content, and an optional delete button.
 *
 * @param comment - Comment data with `id`, `content`, and optional `profiles.username`; username displays as `"unknown"` if missing and the avatar initial falls back to `"?"` when unavailable.
 * @param canDelete - When `true`, shows a delete icon for the comment.
 * @param onDelete - Callback invoked when the delete icon is pressed.
 * @returns The rendered comment row element.
 */
function CommentRow({
  comment, canDelete, onDelete,
}: {
  comment: { id: string; content: string; profiles?: { username: string } | null };
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <View style={styles.commentRow}>
      <View style={styles.commentAvatar}>
        <Text style={styles.commentAvatarText}>
          {comment.profiles?.username?.charAt(0).toUpperCase() ?? "?"}
        </Text>
      </View>
      <View style={styles.commentBody}>
        <Text style={styles.commentUsername}>
          @{comment.profiles?.username ?? "unknown"}
        </Text>
        <Text style={styles.commentContent}>{comment.content}</Text>
      </View>
      {canDelete && (
        <Pressable onPress={onDelete} hitSlop={8}>
          <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
        </Pressable>
      )}
    </View>
  );
}

/**
 * Renders the photo detail screen with viewing, editing, tagging, liking, and commenting features.
 *
 * Displays a photo with like and comment actions, shows title/description (or an owner-only prompt),
 * and conditionally enables edit and delete controls for the owner. Supports adding/removing tags,
 * posting and deleting comments, and shows loading / error states.
 *
 * @returns The component's rendered JSX element for the photo detail screen.
 */

export default function PhotoScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    photo, comments, isLiked, isOwner,
    loading, saving, deleting, liking, loadingComments,
    error,
    save, remove, like,
    postComment, removeComment,
    addTags, removeTag,
  } = usePhoto(id);

  // ── State local UI ─────────────────────────────────────────────────────────
  const [isEditing,     setIsEditing]     = useState(false);
  const [editTitle,     setEditTitle]     = useState("");
  const [editDesc,      setEditDesc]      = useState("");
  const [newTagInput,   setNewTagInput]   = useState("");
  const [commentInput,  setCommentInput]  = useState("");
  const [postingComment,setPostingComment] = useState(false);

  const commentInputRef = useRef<TextInput>(null);

  // Când intram în modul de editare, populăm câmpurile cu valorile curente
  const enterEditMode = () => {
    setEditTitle(photo?.title ?? "");
    setEditDesc(photo?.description ?? "");
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditTitle("");
    setEditDesc("");
  };

  // ── Salvare modificări ────────────────────────────────────────────────────
  const handleSave = async () => {
    const ok = await save({ title: editTitle, description: editDesc });
    if (ok) setIsEditing(false);
    else Alert.alert("Eroare", "Nu s-a putut salva. Încearcă din nou.");
  };

  // ── Ștergere cu confirmare ────────────────────────────────────────────────
  const handleDelete = () => {
    Alert.alert(
      "Șterge poza",
      "Ești sigur? Acțiunea nu poate fi anulată.",
      [
        { text: "Anulează", style: "cancel" },
        {
          text: "Șterge",
          style: "destructive",
          onPress: async () => {
            const ok = await remove();
            if (ok) {
              router.back();
            } else {
              Alert.alert("Eroare", "Nu s-a putut șterge poza.");
            }
          },
        },
      ]
    );
  };

  // ── Adaugă tag ────────────────────────────────────────────────────────────
  const handleAddTag = async () => {
    const tag = newTagInput.trim().toLowerCase();
    if (!tag) return;
    const exists = photo?.photo_tags?.some((t) => t.tag === tag);
    if (exists) { setNewTagInput(""); return; }
    await addTags([tag]);
    setNewTagInput("");
  };

  // ── Trimite comentariu ────────────────────────────────────────────────────
  const handlePostComment = async () => {
    if (!commentInput.trim()) return;
    setPostingComment(true);
    const ok = await postComment(commentInput);
    if (ok) setCommentInput("");
    setPostingComment(false);
  };

  // ── Loading / Error states ─────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (error || !photo) {
    return (
      <View style={styles.center}>
        <Ionicons name="image-outline" size={40} color={COLORS.textMuted} />
        <Text style={styles.errorText}>Poza nu a putut fi încărcată</Text>
        <Button label="Înapoi" onPress={() => router.back()} variant="secondary" size="sm" />
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </Pressable>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {photo.title ?? "Poză"}
        </Text>

        {/* Acțiuni owner */}
        {isOwner && !isEditing && (
          <View style={styles.headerActions}>
            <Pressable style={styles.headerBtn} onPress={enterEditMode}>
              <Ionicons name="create-outline" size={20} color={COLORS.accent} />
            </Pressable>
            <Pressable
              style={styles.headerBtn}
              onPress={handleDelete}
              disabled={deleting}
            >
              {deleting
                ? <ActivityIndicator size="small" color={COLORS.danger} />
                : <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
              }
            </Pressable>
          </View>
        )}

        {/* Acțiuni editare */}
        {isEditing && (
          <View style={styles.headerActions}>
            <Pressable style={styles.headerBtn} onPress={cancelEdit} disabled={saving}>
              <Ionicons name="close" size={22} color={COLORS.textMuted} />
            </Pressable>
            <Pressable style={styles.headerBtn} onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color={COLORS.accent} />
                : <Ionicons name="checkmark" size={22} color={COLORS.accent} />
              }
            </Pressable>
          </View>
        )}

        {/* Placeholder dacă nu e owner */}
        {!isOwner && <View style={{ width: 36 }} />}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Imagine ── */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: photo.image_url }}
            style={styles.image}
            resizeMode="contain"
          />
        </View>

        {/* ── Acțiuni sociale ── */}
        <View style={styles.actionsRow}>
          <Pressable
            style={styles.actionBtn}
            onPress={like}
            disabled={liking}
          >
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={24}
              color={isLiked ? COLORS.danger : COLORS.text}
            />
            <Text style={styles.actionCount}>{photo.likes_count}</Text>
          </Pressable>

          <Pressable
            style={styles.actionBtn}
            onPress={() => commentInputRef.current?.focus()}
          >
            <Ionicons name="chatbubble-outline" size={22} color={COLORS.text} />
            <Text style={styles.actionCount}>{comments.length}</Text>
          </Pressable>
        </View>

        <View style={styles.content}>

          {/* ── Modul VIZUALIZARE ── */}
          {!isEditing && (
            <>
              {photo.title && (
                <Text style={styles.title}>{photo.title}</Text>
              )}
              {photo.description && (
                <Text style={styles.description}>{photo.description}</Text>
              )}
              {!photo.title && !photo.description && isOwner && (
                <Pressable onPress={enterEditMode} style={styles.addInfoPrompt}>
                  <Ionicons name="add-circle-outline" size={18} color={COLORS.accent} />
                  <Text style={styles.addInfoText}>Adaugă titlu și descriere</Text>
                </Pressable>
              )}
            </>
          )}

          {/* ── Modul EDITARE ── */}
          {isEditing && (
            <View style={styles.editSection}>
              <Text style={styles.sectionTitle}>Editează Poza</Text>

              <Input
                label="Titlu"
                placeholder="Ex: Apus la munte"
                value={editTitle}
                onChangeText={setEditTitle}
                leftIcon="text-outline"
                maxLength={100}
                showCharCount
                containerStyle={{ marginBottom: SPACING.md }}
              />

              <Input
                label="Descriere"
                placeholder="Descrie ce e în această poză..."
                value={editDesc}
                onChangeText={setEditDesc}
                leftIcon="document-text-outline"
                maxLength={500}
                showCharCount
                multiline
                numberOfLines={4}
                hint="Apare sub poză pe ecranul de detaliu"
              />

              <View style={styles.saveRow}>
                <Button
                  label="Anulează"
                  onPress={cancelEdit}
                  variant="secondary"
                  size="sm"
                  style={{ flex: 1 }}
                />
                <Button
                  label={saving ? "Se salvează..." : "Salvează"}
                  onPress={handleSave}
                  loading={saving}
                  size="sm"
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          )}

          {/* ── Separator ── */}
          <View style={styles.divider} />

          {/* ── Tags ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tag-uri</Text>

            {/* Afișare tag-uri existente */}
            <View style={styles.tagsRow}>
              {(photo.photo_tags ?? []).map((t) => (
                <TagPill
                  key={t.id}
                  tag={t.tag}
                  isOwner={isOwner}
                  onRemove={() => removeTag(t.tag)}
                />
              ))}
              {(photo.photo_tags ?? []).length === 0 && !isOwner && (
                <Text style={styles.emptyText}>Niciun tag adăugat</Text>
              )}
            </View>

            {/* Input adăugare tag — doar owner */}
            {isOwner && (
              <View style={styles.tagInputRow}>
                <Input
                  placeholder="Adaugă tag (ex: natură)"
                  value={newTagInput}
                  onChangeText={setNewTagInput}
                  onSubmitEditing={handleAddTag}
                  returnKeyType="done"
                  autoCapitalize="none"
                  containerStyle={{ flex: 1 }}
                />
                <Pressable
                  style={[styles.addTagBtn, !newTagInput.trim() && styles.addTagBtnDisabled]}
                  onPress={handleAddTag}
                  disabled={!newTagInput.trim()}
                >
                  <Ionicons name="add" size={20} color={COLORS.bg} />
                </Pressable>
              </View>
            )}
          </View>

          {/* ── Separator ── */}
          <View style={styles.divider} />

          {/* ── Comentarii ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Comentarii ({comments.length})
            </Text>

            {loadingComments ? (
              <ActivityIndicator size="small" color={COLORS.accent} style={{ marginVertical: SPACING.md }} />
            ) : comments.length === 0 ? (
              <Text style={styles.emptyText}>
                Fii primul care comentează!
              </Text>
            ) : (
              comments.map((c) => (
                <CommentRow
                  key={c.id}
                  comment={c}
                  canDelete={isOwner || c.user_id === photo.user_id}
                  onDelete={() => removeComment(c.id)}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── Input comentariu fix jos ── */}
      <View style={[styles.commentInputBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
        <TextInput
          ref={commentInputRef}
          style={styles.commentTextInput}
          placeholder="Scrie un comentariu..."
          placeholderTextColor={COLORS.textMuted}
          value={commentInput}
          onChangeText={setCommentInput}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={handlePostComment}
        />
        <Pressable
          style={[
            styles.sendBtn,
            (!commentInput.trim() || postingComment) && styles.sendBtnDisabled,
          ]}
          onPress={handlePostComment}
          disabled={!commentInput.trim() || postingComment}
        >
          {postingComment
            ? <ActivityIndicator size="small" color={COLORS.bg} />
            : <Ionicons name="send" size={16} color={COLORS.bg} />
          }
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Stiluri ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: {
    flex: 1, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center", gap: SPACING.md,
  },
  errorText: { color: COLORS.textMuted, fontSize: FONT_SIZE.base },

  // Header
  header: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: RADIUS.full,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: {
    flex: 1, color: COLORS.text,
    fontSize: FONT_SIZE.lg, fontWeight: "700",
    textAlign: "center", marginHorizontal: SPACING.sm,
  },
  headerActions: { flexDirection: "row", gap: 4 },

  // Imagine
  imageContainer: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: COLORS.surfaceHigh,
  },
  image: { width: "100%", height: "100%" },

  // Acțiuni sociale
  actionsRow: {
    flexDirection: "row",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  actionCount: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md, fontWeight: "600" },

  // Conținut
  content: { padding: SPACING.md },
  title: {
    color: COLORS.text, fontSize: FONT_SIZE.xl,
    fontWeight: "800", marginBottom: SPACING.sm,
  },
  description: {
    color: COLORS.textSecondary, fontSize: FONT_SIZE.base,
    lineHeight: 22, marginBottom: SPACING.sm,
  },
  addInfoPrompt: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  addInfoText: { color: COLORS.accent, fontSize: FONT_SIZE.sm, fontWeight: "600" },

  // Editare
  editSection: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderAccent,
    gap: SPACING.sm, marginBottom: SPACING.md,
  },
  saveRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },

  // Separatoare și secțiuni
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginVertical: SPACING.md },
  section: { gap: SPACING.sm },
  sectionTitle: {
    color: COLORS.text, fontSize: FONT_SIZE.sm,
    fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8,
  },
  emptyText: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },

  // Tags
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  tag: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.accentSubtle, borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm + 2, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.borderAccent,
  },
  tagText: { color: COLORS.accent, fontSize: FONT_SIZE.xs, fontWeight: "600" },
  tagInputRow: { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start", marginTop: SPACING.xs },
  addTagBtn: {
    width: 46, height: 46, borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent, alignItems: "center", justifyContent: "center",
    marginTop: 20,
  },
  addTagBtnDisabled: { opacity: 0.4 },

  // Comentarii
  commentRow: {
    flexDirection: "row", alignItems: "flex-start",
    gap: SPACING.sm, paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  commentAvatar: {
    width: 32, height: 32, borderRadius: RADIUS.full,
    backgroundColor: COLORS.accentDim,
    alignItems: "center", justifyContent: "center",
  },
  commentAvatarText: { color: COLORS.bg, fontSize: FONT_SIZE.sm, fontWeight: "800" },
  commentBody: { flex: 1 },
  commentUsername: { color: COLORS.accent, fontSize: FONT_SIZE.xs, fontWeight: "700", marginBottom: 2 },
  commentContent: { color: COLORS.text, fontSize: FONT_SIZE.md, lineHeight: 18 },

  // Input comentariu
  commentInputBar: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: SPACING.md, paddingTop: SPACING.sm,
    gap: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  commentTextInput: {
    flex: 1, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    color: COLORS.text, fontSize: FONT_SIZE.base,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: RADIUS.full,
    backgroundColor: COLORS.accent, alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
});