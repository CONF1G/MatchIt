// src/services/catalog.ts
// Toate operațiile CRUD pentru cataloage și pozele din ele.
// Fiecare funcție returnează { data, error } — niciodată nu aruncă excepții.

import { supabase } from "./supabase";
import {
  Catalog, CatalogWithProfile, NewCatalog, UpdateCatalog,
  Photo, NewPhoto, ServiceResponse, PaginatedResponse,
} from "../types/database";
import { API } from "../config/constants";

// ─── CATALOAGE ────────────────────────────────────────────────────────────────

/**
 * Fetches the paginated public catalog feed including profile info, optionally filtered by tag.
 *
 * @param page - Zero-based page index used to compute the range (pageSize = API.PAGE_SIZE_FEED)
 * @param tag - Optional tag (case-insensitive) to filter catalogs whose `tags` array contains the value
 * @returns An object with `data` as a list of catalogs joined with profile fields, `error` as an error message or `null`, `count` as the total number of matching catalogs, and `hasMore` indicating whether additional pages exist
 */
export async function fetchPublicCatalogs(
  page = 0,
  tag?: string
): Promise<PaginatedResponse<CatalogWithProfile>> {
  const from = page * API.PAGE_SIZE_FEED;
  const to   = from + API.PAGE_SIZE_FEED - 1;

  let query = supabase
    .from("catalogs")
    .select("*, profiles(username, avatar_url)", { count: "exact" })
    .eq("is_private", false)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (tag) {
    // contains = array @> în PostgreSQL
    query = query.contains("tags", [tag.toLowerCase()]);
  }

  const { data, error, count } = await query;

  if (error) return { data: null, error: error.message, count: null, hasMore: false };

  const total   = count ?? 0;
  const hasMore = from + (data?.length ?? 0) < total;

  return { data: (data as CatalogWithProfile[]) ?? [], error: null, count: total, hasMore };
}

/**
 * Fetches catalogs owned by the specified user.
 *
 * @param ownerId - UUID of the catalog owner
 * @param includePrivate - If `true`, include private catalogs; defaults to `false`
 * @returns The owner's catalogs joined with profile data as an array, or `null` if an error occurred
 */
export async function fetchUserCatalogs(
  ownerId: string,
  includePrivate = false
): Promise<ServiceResponse<CatalogWithProfile[]>> {
  let query = supabase
    .from("catalogs")
    .select("*, profiles(username, avatar_url)")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (!includePrivate) {
    query = query.eq("is_private", false);
  }

  const { data, error } = await query;

  if (error) return { data: null, error: error.message };
  return { data: data as CatalogWithProfile[], error: null };
}

/**
 * Fetches a catalog by id including its owner's profile and all associated photos.
 *
 * @returns The catalog object with joined `profiles` and a `photos` array, or `null` on error; `error` contains the error message when present.
 */
export async function fetchCatalogById(
  id: string
): Promise<ServiceResponse<CatalogWithProfile & { photos: Photo[] }>> {
  const { data, error } = await supabase
    .from("catalogs")
    .select(`
      *,
      profiles ( username, avatar_url ),
      photos ( * )
    `)
    .eq("id", id)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as any, error: null };
}

/**
 * Create a new catalog owned by the currently authenticated user.
 *
 * If the caller is not authenticated, the function returns an error indicating authentication is required.
 *
 * @param input - New catalog data. `is_private` defaults to `false` if omitted; `tags` defaults to an empty array if omitted.
 * @returns The created `Catalog` when successful; otherwise `data` is `null` and `error` contains the failure message.
 */
export async function createCatalog(
  input: NewCatalog
): Promise<ServiceResponse<Catalog>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Trebuie să fii autentificat" };

  const { data, error } = await supabase
    .from("catalogs")
    .insert({
      ...input,
      owner_id:   user.id,
      is_private: input.is_private ?? false,
      tags:       input.tags ?? [],
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Catalog, error: null };
}

/**
 * Updates an existing catalog.
 *
 * Authorization (ownership) is enforced by the database's Row Level Security; this function does not perform an ownership check.
 *
 * @param id - The ID of the catalog to update
 * @param updates - Partial catalog fields to apply
 * @returns The updated catalog in `data` on success, or `null` in `data` and an error message in `error` on failure
 */
export async function updateCatalog(
  id: string,
  updates: UpdateCatalog
): Promise<ServiceResponse<Catalog>> {
  const { data, error } = await supabase
    .from("catalogs")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Catalog, error: null };
}

/**
 * Deletes a catalog and its associated photos (cascade enforced by the database).
 *
 * @param id - The ID of the catalog to delete
 * @returns `data: null` and `error` set to the error message if deletion failed, otherwise `error: null`
 */
export async function deleteCatalog(
  id: string
): Promise<ServiceResponse<null>> {
  const { error } = await supabase
    .from("catalogs")
    .delete()
    .eq("id", id);

  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

// ─── POZE ─────────────────────────────────────────────────────────────────────

/**
 * Insert a new photo record and associate it with the currently authenticated user.
 *
 * @param input - Photo fields to insert; the service sets `uploader_id` to the authenticated user's id.
 * @returns The created `Photo` as `data` on success; `data` is `null` and `error` contains a message on failure.
 */
export async function addPhoto(
  input: NewPhoto
): Promise<ServiceResponse<Photo>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Trebuie să fii autentificat" };

  const { data, error } = await supabase
    .from("photos")
    .insert({ ...input, uploader_id: user.id })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Photo, error: null };
}

/**
 * Deletes a photo by its id.
 *
 * @param id - The id of the photo to delete
 * @returns `data: null` and `error: <message>` if deletion failed, otherwise `data: null` and `error: null`
 */
export async function deletePhoto(
  id: string
): Promise<ServiceResponse<null>> {
  const { error } = await supabase
    .from("photos")
    .delete()
    .eq("id", id);

  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

/**
 * Update the sort order for multiple photos.
 *
 * @param updates - Array of objects each with `id` (photo id) and `sort_order` (new position)
 * @returns An object with `data` set to `null` and `error` containing an error message on failure, or `null` on success.
 */
export async function updatePhotoOrder(
  updates: Array<{ id: string; sort_order: number }>
): Promise<ServiceResponse<null>> {
  // upsert în batch — mai eficient decât N update-uri separate
  const { error } = await supabase
    .from("photos")
    .upsert(updates, { onConflict: "id" });

  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

// ─── LIKE-URI ─────────────────────────────────────────────────────────────────

/**
 * Toggle the current user's like on a catalog.
 *
 * Requires an authenticated user.
 *
 * @param catalogId - The ID of the catalog to like or unlike
 * @returns `{ isLiked: boolean }` where `isLiked` is `true` if the catalog is liked after the operation, `false` otherwise
 */
export async function toggleCatalogLike(
  catalogId: string
): Promise<ServiceResponse<{ isLiked: boolean }>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Trebuie să fii autentificat" };

  // Verificăm dacă există deja un like
  const { data: existing } = await supabase
    .from("catalog_likes")
    .select("id")
    .eq("catalog_id", catalogId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    // Unlike
    const { error } = await supabase
      .from("catalog_likes")
      .delete()
      .eq("id", existing.id);
    if (error) return { data: null, error: error.message };
    return { data: { isLiked: false }, error: null };
  } else {
    // Like
    const { error } = await supabase
      .from("catalog_likes")
      .insert({ catalog_id: catalogId, user_id: user.id });
    if (error) return { data: null, error: error.message };
    return { data: { isLiked: true }, error: null };
  }
}

/**
 * Determines whether the current user has liked the specified catalog.
 *
 * @returns An object with `isLiked: true` if the current authenticated user has a like row for the catalog, `false` otherwise (unauthenticated users yield `isLiked: false`).
 */
export async function checkCatalogLike(
  catalogId: string
): Promise<ServiceResponse<{ isLiked: boolean }>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: { isLiked: false }, error: null };

  const { data } = await supabase
    .from("catalog_likes")
    .select("id")
    .eq("catalog_id", catalogId)
    .eq("user_id", user.id)
    .maybeSingle();

  return { data: { isLiked: !!data }, error: null };
}