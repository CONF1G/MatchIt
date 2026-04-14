import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Share, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../../services/supabase';
import { fetchMatchPlayers, subscribeToMatchPlayers, joinMatch } from '../../services/lobby';

/**
 * Renders the lobby screen for a match identified by the `id` route parameter.
 *
 * The component reads `id` from the route's search parameters, manages local state
 * for the match, its players, and a loading indicator, and provides the UI and
 * interactions for a match lobby.
 *
 * @returns The React element that displays the match lobby for the given `id`.
 */
export default function LobbyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [match, setMatch] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
    // ... restul logicii din MatchLobby, dar folosind id-ul din parametri
    
}