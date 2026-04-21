import { useLocalSearchParams } from "expo-router";
import { View, Text, ActivityIndicator } from "react-native";
import { COLORS } from "../../config/theme";

/**
 * Render a centered loading screen for a lobby identified by the route `id`.
 *
 * The component reads the `id` route parameter and displays a large accent-colored
 * ActivityIndicator with a monospace "Loading lobby {id}…" label styled using theme colors.
 *
 * @returns A React element containing a centered loading indicator and a text label that shows the lobby `id`.
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
