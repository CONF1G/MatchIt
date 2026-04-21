import { Stack } from "expo-router";
import { COLORS } from "../../config/theme";

export default function GuestLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown:  false,
        contentStyle: { backgroundColor: COLORS.bg },
        animation:    "fade_from_bottom",
      }}
    />
  );
}
