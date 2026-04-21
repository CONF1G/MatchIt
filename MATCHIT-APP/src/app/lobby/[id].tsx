import { useLocalSearchParams } from "expo-router";
import { View, Text, ActivityIndicator } from "react-native";
import { COLORS } from "../../config/theme";

/**
 * Displays a centered loading screen for a lobby identified by the route `id`.
 *
 * @returns A JSX element rendering a full-screen centered view with a large activity indicator and a muted monospace message `Loading lobby {id}…`.
 */
export default function LobbyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg, gap: 12 }}>
      <ActivityIndicator size="large" color={COLORS.accent} />
      <Text style={{ color: COLORS.textMuted, fontFamily: "monospace" }}>
        Loading lobby {id}…
      </Text>
    </View>
  );
}
