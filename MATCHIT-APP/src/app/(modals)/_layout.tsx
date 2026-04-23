import { Stack } from "expo-router";
import { COLORS } from "../../config/theme";

export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown:      false,
        contentStyle:     { backgroundColor: COLORS.bg },
        presentation:     "modal",
        animation:        "slide_from_bottom",
        gestureEnabled:   true,
        gestureDirection: "vertical",
      }}
    />
  );
}
