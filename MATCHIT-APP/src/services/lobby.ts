import { supabase } from './supabase';
import type { Lobby, LobbyParticipant, ParticipantWithProfile, ServiceResponse } from '../types/database';

export async function fetchLobby(lobbyId: string): Promise<ServiceResponse<Lobby>> {
  const { data, error } = await supabase
    .from('lobbies')
    .select('*')
    .eq('id', lobbyId)
    .single();
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function fetchLobbyParticipants(lobbyId: string): Promise<ServiceResponse<ParticipantWithProfile[]>> {
  const { data, error } = await supabase
    .from('lobby_participants')
    .select('*, profiles(username, display_name, avatar_url)')
    .eq('lobby_id', lobbyId)
    .is('left_at', null);
  if (error) return { data: null, error: error.message };
  return { data: data as ParticipantWithProfile[], error: null };
}

export async function joinLobby(lobbyId: string): Promise<ServiceResponse<LobbyParticipant>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { data: null, error: 'Not authenticated' };
  const { data, error } = await supabase
    .from('lobby_participants')
    .upsert({ lobby_id: lobbyId, user_id: session.user.id, role: 'player' }, { onConflict: 'lobby_id,user_id' })
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function leaveLobby(lobbyId: string): Promise<ServiceResponse<null>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { data: null, error: 'Not authenticated' };
  const { error } = await supabase
    .from('lobby_participants')
    .update({ left_at: new Date().toISOString() })
    .eq('lobby_id', lobbyId)
    .eq('user_id', session.user.id);
  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

export async function startLobby(lobbyId: string): Promise<ServiceResponse<null>> {
  const { error } = await supabase
    .from('lobbies')
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', lobbyId);
  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

export function subscribeToLobby(
  lobbyId: string,
  onParticipantsChange: () => void,
  onStatusChange: (status: string) => void,
) {
  return supabase
    .channel(`lobby:${lobbyId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'lobby_participants',
      filter: `lobby_id=eq.${lobbyId}`,
    }, onParticipantsChange)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'lobbies',
      filter: `id=eq.${lobbyId}`,
    }, (payload) => onStatusChange((payload.new as any).status))
    .subscribe();
}
