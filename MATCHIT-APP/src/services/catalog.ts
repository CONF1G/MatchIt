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
 * Fetches the public catalog feed including each catalog's profile information.
 *
 * @param page - Page index starting at 0 used for pagination
 * @param tag - Optional tag to filter results; matching is case-insensitive
 * @returns An object with:
 *  - `data`: an array of catalogs joined with profile info (empty array when none),
 *  - `error`: an error message when the request failed, otherwise `null`,
 *  - `count`: total number of matching catalogs,
 *  - `hasMore`: `true` if there are more pages after the current one, `false` otherwise
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
 * Fetches catalogs owned by a specific user, including each catalog's profile info.
 *
 * @param ownerId - The UUID of the catalog owner
 * @param includePrivate - If `true`, include private catalogs; otherwise only public catalogs are returned
 * @returns An object whose `data` is an array of `CatalogWithProfile` when successful, or `null` and an `error` message on failure
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
 * Fetches a single catalog along with its owner's profile and all associated photos.
 *
 * @param id - The catalog's id
 * @returns The catalog including profile and the `photos` array, or `null` if not found or on error.
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
 * @param input - Catalog fields; `owner_id` is populated from the authenticated user. If `is_private` is omitted it defaults to `false`; `tags` defaults to an empty array.
 * @returns The created `Catalog` in `data` on success; otherwise `data` is `null` and `error` contains an explanatory message.
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
 * Updates an existing catalog identified by `id`.
 *
 * Ownership and authorization are enforced by database RLS; this function performs no local auth checks.
 *
 * @returns The updated `Catalog` object on success; `null` in `data` and an error message in `error` on failure.
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
 * Delete a catalog by its ID; associated photos are removed by database cascade.
 *
 * @param id - The UUID of the catalog to delete
 * @returns An object where `data` is `null` and `error` is the error message on failure or `null` on success
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
 * Creates a new photo record and associates it with the authenticated user.
 *
 * @param input - Photo properties to insert; `uploader_id` will be set to the current user's id
 * @returns An object whose `data` is the created `Photo` and `error` is `null` on success; on failure `data` is `null` and `error` contains the error message
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
 * Deletes a photo from a catalog.
 *
 * @param id - The ID of the photo to delete
 * @returns An object with `data: null` and `error` containing the error message when deletion fails, or `null` on success
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
 * @param updates - Array of objects each containing `id` and `sort_order` to apply the new ordering for that photo
 * @returns An object with `data: null` and `error` set to the Supabase error message if the operation failed, or `null` on success
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
 * @returns `{ isLiked: boolean }` with `isLiked` set to `true` if the catalog is liked after the operation, `false` otherwise.
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
 * Determines whether the current authenticated user has liked the specified catalog.
 *
 * @param catalogId - The ID of the catalog to check for a like.
 * @returns `isLiked` `true` if the current user has a like record for the catalog, `false` otherwise.
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