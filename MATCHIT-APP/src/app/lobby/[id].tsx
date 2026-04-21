import { useLocalSearchParams } from "expo-router";
import { View, Text, ActivityIndicator } from "react-native";
import { COLORS } from "../../config/theme";

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
