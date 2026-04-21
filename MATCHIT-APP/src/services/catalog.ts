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
 * Fetches a paginated list of public catalogs including each owner's profile.
 *
 * Results are ordered by `created_at` descending. If `tag` is provided, catalogs are filtered to those whose `tags` array contains the given tag (case-insensitive).
 *
 * @param page - Page index starting at 0
 * @param tag - Optional tag to filter catalogs; matching is performed on the lowercase form of the provided tag
 * @returns An object with `data` as an array of catalogs joined with profile fields, `error` containing an error message or `null`, `count` with the total number of matching catalogs, and `hasMore` indicating whether additional pages are available
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
 * Fetches catalogs owned by a specific user.
 *
 * @param ownerId - UUID of the catalog owner
 * @param includePrivate - If `true`, include private catalogs owned by the user
 * @returns An array of catalogs including the owner's `username` and `avatar_url` (`CatalogWithProfile[]`), or `null` on error
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
 * Fetches a catalog by its id, including the owner's profile (username, avatar_url) and all associated photos.
 *
 * @returns The fetched catalog with joined `profiles` (username, avatar_url) and a `photos` array; `data` is `null` and `error` contains a message on failure.
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
 * Creates a new catalog owned by the currently authenticated user.
 *
 * If no user is authenticated, the function returns an error indicating authentication is required.
 *
 * @param input - Catalog fields to insert; `is_private` defaults to `false` and `tags` defaults to `[]` when not provided.
 * @returns The created Catalog when successful; `null` when an error occurred (see `error` for details).
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
 * Updates fields of an existing catalog.
 *
 * Ownership and permission checks are enforced by database row-level security (RLS); this function does not perform an ownership check.
 *
 * @param id - The ID of the catalog to update
 * @param updates - Partial catalog fields to apply
 * @returns The updated `Catalog` on success, `null` otherwise
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
 * Delete a catalog and its associated photos (handled by database cascade).
 *
 * @param id - The ID of the catalog to delete
 * @returns An object whose `data` is `null` on success and whose `error` contains an error message on failure
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
 * Inserts a new photo into a catalog and associates it with the authenticated user.
 *
 * @param input - Photo creation payload
 * @returns The created `Photo` in `data`, or `null` in `data` and an error message in `error` on failure
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
 * Deletes a photo by its ID.
 *
 * @param id - The photo's `id` to remove
 * @returns An object with `data` set to `null`; `error` is `null` on success or an error message string on failure
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
 * Update the sort order of multiple photos in a catalog.
 *
 * @param updates - Array of objects each containing `id` (photo id) and `sort_order` (new order index)
 * @returns An object with `data: null` and `error` set to an error message when the upsert fails, `null` on success
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
 * Toggles the authenticated user's like state for a catalog.
 *
 * If a like exists for the current user and catalog it will be removed; otherwise a new like will be created.
 * Returns an error with message "Trebuie să fii autentificat" if there is no authenticated user.
 *
 * @returns `{ isLiked: boolean }` where `isLiked` is `true` if the catalog is now liked, `false` otherwise.
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
 * Checks whether the authenticated user has liked the specified catalog.
 *
 * If no user is authenticated, the function reports the catalog as not liked.
 *
 * @returns `{ isLiked: true }` if the authenticated user has a like for the catalog, `{ isLiked: false }` otherwise.
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