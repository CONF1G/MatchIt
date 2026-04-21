import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

const STORAGE_KEY = "matchit_guest_session";

export type GuestSession = {
  guestId:     string;
  displayName: string;
  matchId:     string;
  inviteCode:  string;
};

// ─── Lobby lookup ─────────────────────────────────────────────────────────────

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

// ─── Session storage ──────────────────────────────────────────────────────────

export async function saveGuestSession(session: GuestSession): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export async function getGuestSession(): Promise<GuestSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GuestSession;
  } catch {
    return null;
  }
}

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

export function getPresenceChannelName(matchId: string) {
  return `match-presence:${matchId}`;
}
