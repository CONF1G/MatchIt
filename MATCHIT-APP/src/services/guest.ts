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
 * Finds a lobby (match) by invite code.
 *
 * The provided `code` is normalized (trimmed and uppercased) before lookup.
 *
 * @param code - Invite code provided by the user
 * @returns An object with `data` set to the matching row when found and active; otherwise `data` is `null` and `error` contains a user-facing message ("Lobby not found. Check your invite code." or "This session has already ended.")
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
 * Persist a guest session to device storage.
 *
 * @param session - The guest session to store (contains `guestId`, `displayName`, `matchId`, and `inviteCode`)
 */

export async function saveGuestSession(session: GuestSession): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

/**
 * Retrieves the persisted guest session from storage.
 *
 * Reads the JSON value stored under STORAGE_KEY in AsyncStorage and parses it into a `GuestSession`; returns `null` if no value exists or if reading/parsing fails.
 *
 * @returns The parsed `GuestSession` if present and valid, `null` otherwise.
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
 * Removes the persisted guest session from storage.
 *
 * Deletes the entry stored under the module's guest session key so subsequent
 * reads return no session.
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
 * Builds the Supabase Realtime Presence channel name for a match.
 *
 * @param matchId - The match identifier
 * @returns The presence channel name in the format `match-presence:<matchId>`
 */
export function getPresenceChannelName(matchId: string) {
  return `match-presence:${matchId}`;
}
