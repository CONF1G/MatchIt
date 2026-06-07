import { Stack } from "expo-router";
import { COLORS } from "../../config/theme";

export default function UserLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown:  false,
        contentStyle: { backgroundColor: COLORS.bg },
        animation:    "slide_from_right",
      }}
    />
  );
}
