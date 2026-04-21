import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

const STORAGE_KEY = "matchit_guest_session";

export type GuestSession = {
  guestId:     string;
  displayName: string;
  matchId:     string;
  inviteCode:  string;
};

/**
 * Looks up a match lobby by its invite code.
 *
 * The `code` is treated case-insensitively and leading/trailing whitespace is ignored when searching.
 *
 * @param code - The invite code provided by the user
 * @returns An object with `data` containing the lobby record (`id`, `mode`, `status`, `invite_code`, `host_id`) when found, otherwise `null`; `error` contains a user-facing message when not found or when the session has ended, otherwise `null`.
 */

export async function getLobbyByCode(
  code: string
): Promise<{ data: any | null; error: string | null }> {
  const { data, error } = await supabase
    .from("matches")
    .select("id, mode, status, invite_code, host_id")
    .eq("invite_code", code.trim().toUpperCase())
    .single();

  if (error || !data) return { data: null, error: "Lobby not found. Check your invite code." };
  if (data.status === "completed") return { data: null, error: "This session has already ended." };
  return { data, error: null };
}

/**
 * Persists a guest session to local storage so it can be restored later.
 *
 * @param session - The guest session to save, containing `guestId`, `displayName`, `matchId`, and `inviteCode`
 */

export async function saveGuestSession(session: GuestSession): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

/**
 * Retrieve the persisted guest session from storage.
 *
 * Attempts to read and parse the session JSON stored under the module storage key; returns `null` if no value is stored or if reading/parsing fails.
 *
 * @returns The stored `GuestSession` when present and valid, `null` otherwise.
 */
export async function getGuestSession(): Promise<GuestSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GuestSession;
  } catch {
    return null;
  }
}

/**
 * Removes any persisted guest session from local storage.
 *
 * Completes silently if no session is stored.
 */
export async function clearGuestSession(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// ─── Presence helpers ─────────────────────────────────────────────────────────
// Guests join via Supabase Realtime Presence — no extra DB tables needed.

export type PresenceMember = {
  type:        "user" | "guest";
  id:          string;
  displayName: string;
  isHost:      boolean;
};

/**
 * Builds the Supabase Realtime presence channel name for a match.
 *
 * @param matchId - The match identifier to include in the channel name
 * @returns The presence channel name formatted as `match-presence:<matchId>`
 */
export function getPresenceChannelName(matchId: string) {
  return `match-presence:${matchId}`;
}
