import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Share, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../../services/supabase';
import { fetchMatchPlayers, subscribeToMatchPlayers, joinMatch } from '../../services/lobby';

export default function LobbyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [match, setMatch] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
    // ... restul logicii din MatchLobby, dar folosind id-ul din parametri
    
}