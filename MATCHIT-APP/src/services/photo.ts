// src/services/photo.ts
// CRUD complet pentru poze: creare, citire, editare titlu/descriere, ștergere.
// Coloane corecte din DB: uploader_id (nu user_id), url (nu image_url).

import { supabase } from "./supabase";
import { uploadCatalogPhoto, deleteStorageFile } from "./storage";
import { API } from "../config/constants";
import { Photo as DBPhoto } from "../types/database";

// ─── Tipuri ───────────────────────────────────────────────────────────────────

export type PhotoTag = {
  id:               string;
  photo_id:         string;
  tag:              string;
  is_ai_generated:  boolean;
  confidence:       number | null;
};

export type Comment = {
  id:         string;
  photo_id:   string | null;
  catalog_id: string | null;
  author_id:  string;
  body:       string;
  created_at: string;
  updated_at: string;
  profiles?:  { username: string; avatar_url: string | null } | null;
};

export type Photo = DBPhoto & {
  profiles?:   { username: string; avatar_url: string | null } | null;
  photo_tags?: PhotoTag[];
  photo_likes?: { user_id: string }[];
};

export type ServiceResponse<T> = { data: T | null; error: string | null };

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createPhoto(params: {
  localUri:    string;
  catalogId:   string;
  title?:      string;
  description?: string;
  tags?:       string[];
  sortOrder?:  number;
}): Promise<ServiceResponse<Photo>> {
  const { localUri, catalogId, title, description, tags = [], sortOrder = 0 } = params;

  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return { data: null, error: "Trebuie să fii autentificat" };

  // 1. Upload în Supabase Storage
  const { data: uploadData, error: uploadError } =
    await uploadCatalogPhoto(localUri, user.id, catalogId);

  if (uploadError || !uploadData) {
    return { data: null, error: uploadError ?? "Eroare la upload" };
  }

  // 2. Insert în tabela photos — coloane aliniate cu database.ts
  const { data: photo, error: dbError } = await supabase
    .from("photos")
    .insert({
      catalog_id:    catalogId,
      uploader_id:   user.id,
      url:           uploadData.url,
      thumbnail_url: uploadData.thumbnailUrl,
      storage_path:  uploadData.path,
      title:         title?.trim()       || null,
      description:   description?.trim() || null,
      sort_order:    sortOrder,
      ai_tags:       tags.map((t) => t.toLowerCase().trim()).filter(Boolean),
    })
    .select()
    .single();

  if (dbError) {
    await deleteStorageFile(API.BUCKET_CATALOG, uploadData.path);
    return { data: null, error: dbError.message };
  }

  return { data: photo as Photo, error: null };
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function fetchPhotoById(id: string): Promise<ServiceResponse<Photo>> {
  // Full query with all joins
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

  if (!error) return { data: data as Photo, error: null };

  // Fallback: skip optional tables that may not exist yet, go straight to bare row
  const { data: bare, error: bareErr } = await supabase
    .from("photos")
    .select("*")
    .eq("id", id)
    .single();

  if (bareErr) return { data: null, error: bareErr.message };
  return { data: bare as Photo, error: null };
}

export async function fetchPhotosByCatalog(
  catalogId: string
): Promise<ServiceResponse<Photo[]>> {
  const { data, error } = await supabase
    .from("photos")
    .select("*, profiles ( username, avatar_url )")
    .eq("catalog_id", catalogId)
    .order("sort_order", { ascending: true });

  if (!error) return { data: (data as Photo[]) ?? [], error: null };

  // Fallback if profiles FK doesn't exist
  const { data: bare, error: bareErr } = await supabase
    .from("photos")
    .select("*")
    .eq("catalog_id", catalogId)
    .order("sort_order", { ascending: true });

  if (bareErr) return { data: null, error: bareErr.message };
  return { data: (bare as Photo[]) ?? [], error: null };
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updatePhoto(
  id: string,
  updates: { title?: string; description?: string }
): Promise<ServiceResponse<Photo>> {
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

export async function reorderPhotos(
  updates: Array<{ id: string; sort_order: number }>
): Promise<ServiceResponse<null>> {
  const { error } = await supabase
    .from("photos")
    .upsert(updates, { onConflict: "id" });

  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deletePhoto(id: string): Promise<ServiceResponse<null>> {
  const { data: photo } = await supabase
    .from("photos")
    .select("storage_path")
    .eq("id", id)
    .single();

  const { error: dbError } = await supabase
    .from("photos")
    .delete()
    .eq("id", id);

  if (dbError) return { data: null, error: dbError.message };

  if (photo?.storage_path) {
    const parts     = photo.storage_path.split("/");
    const fileName  = parts[parts.length - 1];
    const thumbPath = [...parts.slice(0, -1), `thumb_${fileName}`].join("/");
    await Promise.allSettled([
      deleteStorageFile(API.BUCKET_CATALOG, photo.storage_path),
      deleteStorageFile(API.BUCKET_THUMBNAILS, thumbPath),
    ]);
  }

  return { data: null, error: null };
}

// ─── TAGS ─────────────────────────────────────────────────────────────────────

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

export async function togglePhotoLike(
  photoId: string
): Promise<ServiceResponse<{ isLiked: boolean }>> {
  const { data, error } = await supabase
    .rpc("toggle_photo_like", { p_photo_id: photoId });

  if (error) return { data: null, error: error.message };
  // RPC returns boolean directly (true = liked, false = unliked)
  return { data: { isLiked: data as boolean }, error: null };
}

export async function checkPhotoLike(
  photoId: string
): Promise<ServiceResponse<{ isLiked: boolean }>> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
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

export async function fetchComments(
  photoId: string
): Promise<ServiceResponse<Comment[]>> {
  // Try with profiles join (author_id → profiles.id FK)
  const { data, error } = await supabase
    .from("comments")
    .select("*, profiles:author_id ( username, avatar_url )")
    .eq("photo_id", photoId)
    .order("created_at", { ascending: true });

  if (!error) return { data: (data as Comment[]) ?? [], error: null };

  // Try bare rows without profiles join
  const { data: bare, error: bareErr } = await supabase
    .from("comments")
    .select("*")
    .eq("photo_id", photoId)
    .order("created_at", { ascending: true });

  if (!bareErr) return { data: (bare as Comment[]) ?? [], error: null };

  // photo_id column doesn't exist yet (migration pending) — return empty silently
  return { data: [], error: null };
}

export async function addComment(
  photoId: string,
  body: string
): Promise<ServiceResponse<Comment>> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return { data: null, error: "Trebuie să fii autentificat" };

  const { data, error } = await supabase
    .from("comments")
    .insert({ photo_id: photoId, author_id: user.id, body: body.trim() })
    .select("*")
    .single();

  if (error) return { data: null, error: error.message };

  return {
    data: {
      ...(data as Comment),
      profiles: { username: user.email?.split("@")[0] ?? "me", avatar_url: null },
    },
    error: null,
  };
}

export async function deleteComment(id: string): Promise<ServiceResponse<null>> {
  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", id);

  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}
