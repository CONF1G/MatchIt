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
 * Aduce feed-ul public de cataloage, cu join pe profiles.
 * @param page  Numărul paginii (începe de la 0)
 * @param tag   Filtrare opțională după tag
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
 * Aduce cataloagele unui utilizator specific.
 * @param ownerId        UUID-ul proprietarului
 * @param includePrivate Dacă true, include și cataloagele private
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
 * Aduce un catalog individual cu toate pozele lui.
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
 * Creează un catalog nou pentru utilizatorul autentificat.
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
 * Actualizează un catalog existent.
 * Verificarea că userul este owner-ul se face prin RLS în DB.
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
 * Șterge un catalog și toate pozele asociate (CASCADE în DB).
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
 * Adaugă o poză într-un catalog.
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
 * Șterge o poză dintr-un catalog.
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
 * Actualizează ordinea pozelor dintr-un catalog.
 * @param updates Array de { id, sort_order }
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
 * Toggle like pe un catalog.
 * Dacă există → îl șterge. Dacă nu există → îl creează.
 * @returns isLiked — starea după operație
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
 * Verifică dacă userul curent a dat like la un catalog.
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