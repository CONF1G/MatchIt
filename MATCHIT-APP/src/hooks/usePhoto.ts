// src/hooks/usePhoto.ts
// Hook custom pentru gestionarea completă a unei poze:
// fetch, update titlu/descriere, delete, like, tags, comments.

import { useState, useEffect, useCallback } from "react";
import {
  fetchPhotoById, updatePhoto, deletePhoto,
  togglePhotoLike, checkPhotoLike,
  fetchComments, addComment, deleteComment,
  addTagsToPhoto, removeTagFromPhoto,
  Photo, Comment, PhotoTag,
} from "../services/photo";
import { useAuth } from "./useAuth";

// ─── Tipuri returnate de hook ─────────────────────────────────────────────────

type UsePhotoReturn = {
  // Date
  photo:       Photo | null;
  comments:    Comment[];
  isLiked:     boolean;
  isOwner:     boolean;

  // Stări de loading
  loading:     boolean;
  saving:      boolean;   // update în curs
  deleting:    boolean;
  liking:      boolean;
  loadingComments: boolean;

  // Erori
  error:       string | null;

  // Acțiuni
  refresh:     () => Promise<void>;
  save:        (updates: { title?: string; description?: string }) => Promise<boolean>;
  remove:      () => Promise<boolean>;
  like:        () => Promise<void>;
  postComment: (content: string) => Promise<boolean>;
  removeComment:(id: string) => Promise<void>;
  addTags:     (tags: string[]) => Promise<void>;
  removeTag:   (tag: string) => Promise<void>;
};

// ─── Hook-ul ──────────────────────────────────────────────────────────────────

/**
 * Manages client-side state and actions for a single photo (fetching, edits, deletion, likes, comments, and tags).
 *
 * Provides state (photo, comments, isLiked, isOwner), loading/error flags, and action handlers for refreshing, saving,
 * removing, toggling like, posting/removing comments, and adding/removing tags.
 *
 * @param photoId - The UUID of the photo to manage
 * @returns An object containing photo state, loading/error flags, and action functions (`refresh`, `save`, `remove`, `like`,
 * `postComment`, `removeComment`, `addTags`, `removeTag`)
 */
export function usePhoto(photoId: string): UsePhotoReturn {
  const { user } = useAuth();

  const [photo,    setPhoto]    = useState<Photo | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLiked,  setIsLiked]  = useState(false);

  const [loading,         setLoading]         = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [deleting,        setDeleting]        = useState(false);
  const [liking,          setLiking]          = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [error,           setError]           = useState<string | null>(null);

  // Userul curent este owner-ul pozei?
  const isOwner = !!user && photo?.user_id === user.id;

  // ── Fetch poză ────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!photoId) return;
    setLoading(true);
    setError(null);

    const [photoRes, likeRes] = await Promise.all([
      fetchPhotoById(photoId),
      checkPhotoLike(photoId),
    ]);

    if (photoRes.error) {
      setError(photoRes.error);
    } else {
      setPhoto(photoRes.data);
    }

    setIsLiked(likeRes.data?.isLiked ?? false);
    setLoading(false);
  }, [photoId]);

  // ── Fetch comentarii ──────────────────────────────────────────────────────
  const loadComments = useCallback(async () => {
    if (!photoId) return;
    setLoadingComments(true);
    const { data } = await fetchComments(photoId);
    setComments(data ?? []);
    setLoadingComments(false);
  }, [photoId]);

  useEffect(() => {
    refresh();
    loadComments();
  }, [photoId]);

  // ── Save (update titlu / descriere) ───────────────────────────────────────
  /**
   * Salvează modificările de titlu/descriere.
   * @returns true dacă a reușit, false dacă a apărut o eroare
   */
  const save = useCallback(async (
    updates: { title?: string; description?: string }
  ): Promise<boolean> => {
    if (!photoId) return false;
    setSaving(true);

    const { data, error } = await updatePhoto(photoId, updates);

    if (error) {
      setError(error);
      setSaving(false);
      return false;
    }

    // Optimistic update local — nu refacem fetch complet
    setPhoto((prev) => prev ? { ...prev, ...data } : prev);
    setSaving(false);
    return true;
  }, [photoId]);

  // ── Delete ────────────────────────────────────────────────────────────────
  /**
   * Șterge poza din DB și Storage.
   * @returns true dacă a reușit
   */
  const remove = useCallback(async (): Promise<boolean> => {
    if (!photoId) return false;
    setDeleting(true);

    const { error } = await deletePhoto(photoId);

    if (error) {
      setError(error);
      setDeleting(false);
      return false;
    }

    setDeleting(false);
    return true;
  }, [photoId]);

  // ── Like / Unlike ─────────────────────────────────────────────────────────
  const like = useCallback(async () => {
    if (!user || liking) return;
    setLiking(true);

    // Optimistic update imediat
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setPhoto((prev) =>
      prev
        ? { ...prev, likes_count: prev.likes_count + (wasLiked ? -1 : 1) }
        : prev
    );

    const { error } = await togglePhotoLike(photoId);

    // Revert dacă a eșuat
    if (error) {
      setIsLiked(wasLiked);
      setPhoto((prev) =>
        prev
          ? { ...prev, likes_count: prev.likes_count + (wasLiked ? 1 : -1) }
          : prev
      );
    }

    setLiking(false);
  }, [photoId, isLiked, liking, user]);

  // ── Comentarii ────────────────────────────────────────────────────────────
  const postComment = useCallback(async (content: string): Promise<boolean> => {
    if (!content.trim()) return false;

    const { data, error } = await addComment(photoId, content);
    if (error || !data) return false;

    // Append optimistic
    setComments((prev) => [...prev, data]);
    return true;
  }, [photoId]);

  const removeComment = useCallback(async (id: string) => {
    // Optimistic delete
    setComments((prev) => prev.filter((c) => c.id !== id));
    await deleteComment(id);
  }, []);

  // ── Tags ──────────────────────────────────────────────────────────────────
  const addTags = useCallback(async (tags: string[]) => {
    if (!tags.length) return;
    const { data } = await addTagsToPhoto(photoId, tags, false);
    if (data) {
      setPhoto((prev) =>
        prev ? { ...prev, photo_tags: [...(prev.photo_tags ?? []), ...data] } : prev
      );
    }
  }, [photoId]);

  const removeTag = useCallback(async (tag: string) => {
    await removeTagFromPhoto(photoId, tag);
    setPhoto((prev) =>
      prev
        ? { ...prev, photo_tags: prev.photo_tags?.filter((t) => t.tag !== tag) }
        : prev
    );
  }, [photoId]);

  return {
    photo, comments, isLiked, isOwner,
    loading, saving, deleting, liking, loadingComments,
    error,
    refresh, save, remove, like,
    postComment, removeComment,
    addTags, removeTag,
  };
}