import { Stack } from "expo-router";
import { COLORS } from "../../config/theme";

/**
 * Provides a layout that renders screens as modals using an Expo Router `Stack`.
 *
 * @returns A React element containing a `Stack` configured for modal presentation: header hidden, content background set to `COLORS.bg`, slide-from-bottom animation, and vertical gesture navigation.
 */
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
