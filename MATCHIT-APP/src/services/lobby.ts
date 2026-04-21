// src/services/lobby.ts
import { supabase } from './supabase';

export const createMatch = async (mode: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User must be authenticated");  
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data, error } = await supabase
    .from('matches')
    .insert({ host_id: user.id, mode, status: 'waiting', invite_code: inviteCode }) 
    .select()
    .single();
  if (error) throw error;
  await joinMatch(data.id);
  return data;
};

export const joinMatch = async (matchId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User must be authenticated"); 
  const { error } = await supabase
    .from('match_players')
    .upsert({ match_id: matchId, user_id: user.id }, { onConflict: 'match_id,user_id' });
  if (error) throw error;
};

export const fetchMatchPlayers = async (matchId: string) => {
  const { data, error } = await supabase
    .from('match_players')
    .select('*, profiles(username, avatar_url)')
    .eq('match_id', matchId);
  if (error) throw error;
  return data;
};

export const subscribeToMatchPlayers = (matchId: string, onUpdate: () => void) => {
  const channel = supabase
    .channel(`match_players:${matchId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'match_players', filter: `match_id=eq.${matchId}` }, onUpdate)
    .subscribe();
  return channel;
};