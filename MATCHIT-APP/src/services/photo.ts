// src/services/photo.ts
// CRUD complet pentru poze: creare, citire, editare titlu/descriere, ștergere.
// Aliniat cu schema din PRD: photos, photo_tags, photo_likes, comments.

import { supabase } from "./supabase";
import { uploadCatalogPhoto, deleteStorageFile } from "./storage";
import { API } from "../config/constants";

// ─── Tipuri aliniate cu schema PRD ────────────────────────────────────────────

export type Photo = {
  id:            string;
  catalog_id:    string;
  user_id:       string;           // PRD folosește user_id (nu uploader_id)
  image_url:     string;
  thumbnail_url: string | null;
  storage_path:  string | null;
  title:         string | null;    // ← cerința ta
  description:   string | null;    // ← cerința ta
  likes_count:   number;
  sort_order:    number;
  created_at:    string;
  updated_at:    string;
  // join-uri opționale
  profiles?:     { username: string; avatar_url: string | null } | null;
  photo_tags?:   PhotoTag[];
  photo_likes?:  { user_id: string }[];
};

export type PhotoTag = {
  id:               string;
  photo_id:         string;
  tag:              string;
  is_ai_generated:  boolean;
  confidence:       number | null;
};

export type Comment = {
  id:         string;
  photo_id:   string;
  user_id:    string;
  content:    string;
  created_at: string;
  updated_at: string;
  profiles?:  { username: string; avatar_url: string | null } | null;
};

export type ServiceResponse<T> = { data: T | null; error: string | null };

// ─── CREATE ───────────────────────────────────────────────────────────────────

/**
 * Uploads an image to storage and creates a photo record in the database, optionally attaching manual tags.
 *
 * @param params.localUri - Local file URI of the image (for example, from ImagePicker)
 * @param params.catalogId - ID of the catalog where the photo will be added
 * @param params.title - Optional title; empty or whitespace-only values are stored as null
 * @param params.description - Optional description; empty or whitespace-only values are stored as null
 * @param params.tags - Optional array of manual tags to attach to the photo
 * @param params.sortOrder - Optional sort order within the catalog (defaults to 0)
 * @returns ServiceResponse containing the created Photo in `data` on success; `data` is null and `error` contains a message on failure
 */
export async function createPhoto(params: {
  localUri:    string;
  catalogId:   string;
  title?:      string;
  description?: string;
  tags?:       string[];
  sortOrder?:  number;
}): Promise<ServiceResponse<Photo>> {
  const { localUri, catalogId, title, description, tags = [], sortOrder = 0 } = params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Trebuie să fii autentificat" };

  // 1. Upload în Supabase Storage
  const { data: uploadData, error: uploadError } =
    await uploadCatalogPhoto(localUri, user.id, catalogId);

  if (uploadError || !uploadData) {
    return { data: null, error: uploadError ?? "Eroare la upload" };
  }

  // 2. Insert în tabela photos
  const { data: photo, error: dbError } = await supabase
    .from("photos")
    .insert({
      catalog_id:    catalogId,
      user_id:       user.id,
      image_url:     uploadData.url,
      thumbnail_url: uploadData.thumbnailUrl,
      storage_path:  uploadData.path,
      title:         title?.trim()       || null,
      description:   description?.trim() || null,
      sort_order:    sortOrder,
    })
    .select()
    .single();

  if (dbError) {
    // Dacă insert în DB eșuează, ștergem și din Storage
    await deleteStorageFile(API.BUCKET_CATALOG, uploadData.path);
    return { data: null, error: dbError.message };
  }

  // 3. Adăugăm tag-urile manuale (dacă există)
  if (tags.length > 0) {
    await addTagsToPhoto(photo.id, tags, false);
  }

  return { data: photo as Photo, error: null };
}

// ─── READ ─────────────────────────────────────────────────────────────────────

/**
 * Fetches a photo by id including the uploader's profile, tags, and likes.
 *
 * @returns A ServiceResponse whose `data` is the photo (with `profiles`, `photo_tags`, and `photo_likes` joined) when successful; `data` is `null` and `error` contains an error message otherwise.
 */
export async function fetchPhotoById(id: string): Promise<ServiceResponse<Photo>> {
  const { data, error } = await supabase
    .from("photos")
    .select(`
      *,
      profiles ( username, avatar_url ),
      photo_tags ( id, tag, is_ai_generated, confidence ),
      photo_likes ( user_id )
    `)
    .eq("id", id)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Photo, error: null };
}

/**
 * Fetches all photos in a catalog ordered by ascending `sort_order`.
 *
 * @param catalogId - The catalog's identifier to filter photos by
 * @returns The list of `Photo` records for the catalog ordered by `sort_order`; an empty array if none are found
 */
export async function fetchPhotosByCatalog(
  catalogId: string
): Promise<ServiceResponse<Photo[]>> {
  const { data, error } = await supabase
    .from("photos")
    .select(`
      *,
      profiles ( username, avatar_url ),
      photo_tags ( id, tag, is_ai_generated, confidence )
    `)
    .eq("catalog_id", catalogId)
    .order("sort_order", { ascending: true });

  if (error) return { data: null, error: error.message };
  return { data: (data as Photo[]) ?? [], error: null };
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

/**
 * Update a photo's title and/or description.
 *
 * Title and description are trimmed; an empty string is stored as `null`. Row-Level Security (RLS) enforces permission checks.
 *
 * @returns The updated `Photo` on success, `null` if the update failed.
 */
export async function updatePhoto(
  id: string,
  updates: { title?: string; description?: string }
): Promise<ServiceResponse<Photo>> {
  // Normalizăm: string gol → null
  const payload: Record<string, string | null> = {};
  if ("title"       in updates) payload.title       = updates.title?.trim()       || null;
  if ("description" in updates) payload.description = updates.description?.trim() || null;

  const { data, error } = await supabase
    .from("photos")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Photo, error: null };
}

/**
 * Set `sort_order` for multiple photos in a single batch operation.
 *
 * @param updates - Array of objects containing `id` and the new `sort_order` for each photo
 * @returns `data: null` and `error` set to the database error message if the upsert failed, `error: null` on success
 */
export async function reorderPhotos(
  updates: Array<{ id: string; sort_order: number }>
): Promise<ServiceResponse<null>> {
  // upsert în batch — mai eficient decât N update-uri
  const { error } = await supabase
    .from("photos")
    .upsert(updates, { onConflict: "id" });

  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

/**
 * Deletes a photo record and its stored files.
 *
 * Deletes the photo row from the database (DB-side cascade removes related `photo_tags`, `photo_likes`, and `comments`), then attempts best-effort deletion of the image and thumbnail files from storage.
 *
 * @param id - The photo's database id
 * @returns An object where `data` is `null` and `error` is `null` on success; otherwise `data` is `null` and `error` contains the failure message.
 */
export async function deletePhoto(id: string): Promise<ServiceResponse<null>> {
  // 1. Fetch calea din Storage înainte de delete
  const { data: photo } = await supabase
    .from("photos")
    .select("storage_path, thumbnail_url")
    .eq("id", id)
    .single();

  // 2. Șterge din DB (RLS permite doar owner-ului)
  const { error: dbError } = await supabase
    .from("photos")
    .delete()
    .eq("id", id);

  if (dbError) return { data: null, error: dbError.message };

  // 3. Curăță fișierele din Storage (best-effort, nu blocăm dacă eșuează)
  if (photo?.storage_path) {
    await deleteStorageFile(API.BUCKET_CATALOG, photo.storage_path);
    // Thumbnail-ul e în bucket separat
    const thumbPath = photo.storage_path.replace("catalog-photos", "thumbnails");
    await deleteStorageFile(API.BUCKET_THUMBNAILS, thumbPath);
  }

  return { data: null, error: null };
}

// ─── TAGS ─────────────────────────────────────────────────────────────────────

/**
 * Add or update tags for a photo.
 *
 * Creates or updates tag records for the given photo. Tags are normalized to
 * lowercase and trimmed; each tag can be marked as AI-generated and may include
 * an optional per-tag confidence score.
 *
 * @param photoId - ID of the photo to attach tags to
 * @param tags - Array of tag strings to add or update
 * @param isAiGenerated - Whether the provided tags originate from an AI source
 * @param confidences - Optional parallel array of confidence scores matching `tags` (index-aligned)
 * @returns The inserted or updated `PhotoTag` rows
 */
export async function addTagsToPhoto(
  photoId:       string,
  tags:          string[],
  isAiGenerated: boolean = false,
  confidences?:  number[]
): Promise<ServiceResponse<PhotoTag[]>> {
  const rows = tags.map((tag, i) => ({
    photo_id:        photoId,
    tag:             tag.toLowerCase().trim(),
    is_ai_generated: isAiGenerated,
    confidence:      confidences?.[i] ?? null,
  }));

  const { data, error } = await supabase
    .from("photo_tags")
    .upsert(rows, { onConflict: "photo_id,tag" })
    .select();

  if (error) return { data: null, error: error.message };
  return { data: data as PhotoTag[], error: null };
}

/**
 * Deletes a specific tag from a photo.
 *
 * @param photoId - ID of the photo
 * @param tag - Tag to remove; the tag is lowercased before matching
 * @returns An object with `data: null` and `error: null` on success, or `data: null` and `error` set to the database error message on failure
 */
export async function removeTagFromPhoto(
  photoId: string,
  tag:     string
): Promise<ServiceResponse<null>> {
  const { error } = await supabase
    .from("photo_tags")
    .delete()
    .eq("photo_id", photoId)
    .eq("tag", tag.toLowerCase());

  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

// ─── LIKES ────────────────────────────────────────────────────────────────────

/**
 * Toggle the current user's like status for a photo.
 *
 * @param photoId - ID of the photo to toggle the like for
 * @returns An object `{ isLiked: boolean }` where `isLiked` is `true` if the photo is liked after the toggle, `false` otherwise
 */
export async function togglePhotoLike(
  photoId: string
): Promise<ServiceResponse<{ isLiked: boolean }>> {
  const { data, error } = await supabase
    .rpc("toggle_photo_like", { p_photo_id: photoId });

  if (error) return { data: null, error: error.message };
  return { data: { isLiked: (data as any).is_liked }, error: null };
}

/**
 * Determine whether the current authenticated user has liked the specified photo.
 *
 * @param photoId - The ID of the photo to check
 * @returns `isLiked` set to `true` if the current user has liked the photo, `false` otherwise.
 */
export async function checkPhotoLike(
  photoId: string
): Promise<ServiceResponse<{ isLiked: boolean }>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: { isLiked: false }, error: null };

  const { data } = await supabase
    .from("photo_likes")
    .select("id")
    .eq("photo_id", photoId)
    .eq("user_id", user.id)
    .maybeSingle();

  return { data: { isLiked: !!data }, error: null };
}

// ─── COMMENTS ─────────────────────────────────────────────────────────────────

/**
 * Fetches comments for a photo ordered by creation time (oldest first).
 *
 * @param photoId - ID of the photo whose comments to fetch
 * @returns An array of `Comment` objects ordered by `created_at` (empty array if there are no comments)
 */
export async function fetchComments(
  photoId: string
): Promise<ServiceResponse<Comment[]>> {
  const { data, error } = await supabase
    .from("comments")
    .select("*, profiles(username, avatar_url)")
    .eq("photo_id", photoId)
    .order("created_at", { ascending: true });

  if (error) return { data: null, error: error.message };
  return { data: (data as Comment[]) ?? [], error: null };
}

/**
 * Insert a new comment for a photo authored by the current user.
 *
 * Requires an authenticated user; returns an authentication error when no user is present.
 *
 * @param photoId - The ID of the photo to attach the comment to
 * @param content - The comment text; leading and trailing whitespace will be trimmed
 * @returns The created `Comment` including the author's `profiles` (username and avatar_url), or `null` if an error occurred
 */
export async function addComment(
  photoId: string,
  content: string
): Promise<ServiceResponse<Comment>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Trebuie să fii autentificat" };

  const { data, error } = await supabase
    .from("comments")
    .insert({ photo_id: photoId, user_id: user.id, content: content.trim() })
    .select("*, profiles(username, avatar_url)")
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Comment, error: null };
}

/**
 * Delete a comment by its id; row-level security enforces who can perform the deletion.
 *
 * @param id - The id of the comment to delete
 * @returns A ServiceResponse with `data` set to `null`; `error` contains the error message if deletion failed, or `null` on success
 */
export async function deleteComment(id: string): Promise<ServiceResponse<null>> {
  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", id);

  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}