import { supabase } from "./supabase";
import { normalizeStorageUrl } from "./storage";
import { Profile, CatalogWithProfile, ServiceResponse } from "../types/database";

export type CatalogPreview = CatalogWithProfile & { previewPhotos: string[] };

export async function fetchUserProfile(userId: string): Promise<ServiceResponse<Profile>> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as Profile, error: null };
}

// Returns a map of catalogId → up to 4 normalized photo URLs
export async function fetchCatalogPreviews(
  catalogIds: string[]
): Promise<Record<string, string[]>> {
  if (!catalogIds.length) return {};

  const results = await Promise.all(
    catalogIds.map((id) =>
      supabase
        .from("photos")
        .select("thumbnail_url, url")
        .eq("catalog_id", id)
        .order("sort_order", { ascending: true })
        .limit(4)
    )
  );

  const map: Record<string, string[]> = {};
  catalogIds.forEach((id, i) => {
    map[id] = (results[i].data ?? [])
      .map((p) => normalizeStorageUrl(p.thumbnail_url ?? p.url))
      .filter((u): u is string => !!u);
  });
  return map;
}

export async function fetchUserPublicCatalogs(
  userId: string
): Promise<ServiceResponse<CatalogPreview[]>> {
  const { data: catalogs, error } = await supabase
    .from("catalogs")
    .select("*, profiles(username, avatar_url)")
    .eq("owner_id", userId)
    .eq("is_private", false)
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: error.message };
  if (!catalogs?.length) return { data: [], error: null };

  const previewMap = await fetchCatalogPreviews(catalogs.map((c) => c.id));

  return {
    data: (catalogs as CatalogWithProfile[]).map((c) => ({
      ...c,
      previewPhotos: previewMap[c.id] ?? [],
    })),
    error: null,
  };
}

export async function checkIsFollowing(
  followerId: string,
  followingId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();
  return !!data;
}

export async function followUser(followingId: string): Promise<ServiceResponse<null>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { data: null, error: "Not authenticated" };
  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: session.user.id, following_id: followingId });
  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

export async function unfollowUser(followingId: string): Promise<ServiceResponse<null>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { data: null, error: "Not authenticated" };
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", session.user.id)
    .eq("following_id", followingId);
  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

// ─── Catalog saves (bookmarks) ────────────────────────────────────────────────

export async function checkCatalogSaved(catalogId: string): Promise<boolean> {
  const { data } = await supabase
    .from("catalog_saves")
    .select("id")
    .eq("catalog_id", catalogId)
    .maybeSingle();
  return !!data;
}

export async function saveCatalog(catalogId: string): Promise<ServiceResponse<null>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { data: null, error: "Not authenticated" };
  const { error } = await supabase
    .from("catalog_saves")
    .insert({ user_id: session.user.id, catalog_id: catalogId });
  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

export async function unsaveCatalog(catalogId: string): Promise<ServiceResponse<null>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { data: null, error: "Not authenticated" };
  const { error } = await supabase
    .from("catalog_saves")
    .delete()
    .eq("catalog_id", catalogId)
    .eq("user_id", session.user.id);
  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

export async function fetchSavedCatalogs(): Promise<ServiceResponse<CatalogWithProfile[]>> {
  const { data, error } = await supabase
    .from("catalog_saves")
    .select("catalog_id, catalogs(*, profiles(username, avatar_url))")
    .order("created_at", { ascending: false });
  if (error) return { data: null, error: error.message };
  const catalogs = (data ?? []).map((row: any) => row.catalogs).filter(Boolean);
  return { data: catalogs as CatalogWithProfile[], error: null };
}
