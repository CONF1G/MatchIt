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
 * Uploadează o poză și o salvează în DB cu titlu și descriere.
 * @param localUri    URI-ul local al imaginii (de la ImagePicker)
 * @param catalogId   Catalogul în care se adaugă
 * @param title       Titlul pozei (opțional)
 * @param description Descrierea pozei (opțional)
 * @param tags        Tag-uri manuale (opțional)
 * @param sortOrder   Ordinea în catalog
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
 * Aduce o poză cu toate detaliile: tags, profil uploader, număr likes.
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
 * Aduce toate pozele unui catalog, ordonate după sort_order.
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
 * Actualizează titlul și/sau descrierea unei poze.
 * RLS asigură că doar owner-ul poate face update.
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
 * Actualizează ordinea mai multor poze simultan (drag & drop reorder).
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
 * Șterge o poză din DB și din Storage.
 * Ștergerea din DB va cascada la photo_tags, photo_likes, comments.
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
 * Adaugă tag-uri la o poză.
 * @param isAiGenerated true dacă vin de la AI, false dacă sunt manuale
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
 * Șterge un tag specific de pe o poză.
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
 * Toggle like pe o poză folosind RPC-ul din DB.
 * RPC-ul gestionează atomic insert/delete și returnează noul status.
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
 * Verifică dacă userul curent a dat like la o poză.
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
 * Aduce comentariile unei poze, ordonate cronologic.
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
 * Adaugă un comentariu la o poză.
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
 * Șterge un comentariu (doar autorul îl poate șterge — RLS).
 */
export async function deleteComment(id: string): Promise<ServiceResponse<null>> {
  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", id);

  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}