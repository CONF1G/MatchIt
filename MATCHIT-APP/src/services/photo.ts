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
 * Uploads a photo to storage and creates a corresponding photo row in the database.
 *
 * If the user is not authenticated, the function returns an error. The image is uploaded to storage first; if the subsequent database insert fails the uploaded file is deleted. Manual `tags`, if provided, are added after the photo row is created (tag addition is attempted but does not roll back the created photo on failure).
 *
 * @param localUri - Local URI of the image (e.g., from an image picker)
 * @param catalogId - ID of the catalog the photo belongs to
 * @param title - Optional title for the photo; empty strings are trimmed and stored as `null`
 * @param description - Optional description for the photo; empty strings are trimmed and stored as `null`
 * @param tags - Optional array of manual tags to attach to the created photo
 * @param sortOrder - Optional sort order within the catalog (defaults to 0)
 * @returns The created `Photo` on success, `null` otherwise (error message provided in the service response)
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
 * Fetches a photo by id including the uploader's profile, associated tags, and likes.
 *
 * @returns The fetched `Photo` with joined `profiles` (username, avatar_url), `photo_tags`, and `photo_likes`, or `null` if the photo could not be retrieved; `error` contains the failure message when applicable.
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
 * Fetches all photos for a catalog ordered by their `sort_order`.
 *
 * @param catalogId - The catalog's ID to fetch photos for
 * @returns An array of `Photo` objects belonging to the catalog, or `[]` if none
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
 * Trims provided strings and converts empty strings to `null` before saving.
 * Row-level security (RLS) enforces that only the photo owner can perform the update.
 *
 * @param id - The photo's unique identifier
 * @param updates - Fields to update; `title` and/or `description` will be trimmed and empty values set to `null`
 * @returns The updated `Photo` on success, `null` otherwise
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
 * Update the `sort_order` for multiple photos in a single batch operation.
 *
 * @returns An object with `data` set to `null`; `error` contains the error message on failure, or `null` on success.
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
 * Delete a photo and its associated storage files.
 *
 * Deletes the photo row from the database (database cascades will remove related `photo_tags`, `photo_likes`, and `comments`). If the DB deletion succeeds, performs a best-effort removal of the photo file and its thumbnail from storage. Deletion is subject to Row Level Security (only the photo owner can delete).
 *
 * @returns An object with `data` set to `null` on success, and `error` set to an error message if the operation failed, `null` otherwise.
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
 * Attach tags to a photo.
 *
 * Normalizes each tag to lowercase and trimmed text, sets `is_ai_generated` according to `isAiGenerated`,
 * and assigns per-tag confidence values when provided. Inserts or updates tags using `photo_id`+`tag` as the conflict key.
 *
 * @param photoId - ID of the photo to tag
 * @param tags - Array of tag strings to add
 * @param isAiGenerated - Whether the tags were generated by AI (default: `false`)
 * @param confidences - Optional array of confidence scores aligned with `tags`; a missing entry becomes `null`
 * @returns The inserted or upserted `PhotoTag` rows for the photo
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
 * Removes a specific tag from a photo.
 *
 * @param photoId - The ID of the photo
 * @param tag - The tag to remove; matching is performed against the tag lowercased
 * @returns An object with `data` set to `null` and `error` set to `null` on success, or `error` containing the failure message
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
 * Toggle the current user's like state for a photo.
 *
 * @returns `{ isLiked: true }` if the photo is liked after the operation, `{ isLiked: false }` otherwise.
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
 * Determines whether the currently authenticated user has liked the specified photo.
 *
 * If no user is authenticated, the function returns `isLiked: false`.
 *
 * @param photoId - The ID of the photo to check for a like by the current user
 * @returns An object with `isLiked`: `true` if the current user has liked the photo, `false` otherwise
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
 * @param photoId - The ID of the photo whose comments to fetch
 * @returns The list of comments for the photo, or an empty array if none exist
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
 * Insert a new comment for the specified photo as the current authenticated user.
 *
 * @param photoId - The ID of the photo to attach the comment to
 * @param content - The comment text; it will be trimmed before insertion
 * @returns The inserted `Comment` (including joined `profiles.username` and `profiles.avatar_url`) on success, `null` on error
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
 * Deletes a comment by ID; only the comment's author is allowed to delete it (enforced by row-level security).
 *
 * @param id - The ID of the comment to delete
 * @returns `data` is `null`; `error` is `null` on success or contains an error message on failure
 */
export async function deleteComment(id: string): Promise<ServiceResponse<null>> {
  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", id);

  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}